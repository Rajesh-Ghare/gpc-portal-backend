import type { z } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as productRepo from '../repositories/productRepository';
import * as priceRepo from '../repositories/productPriceRepository';
import { recordAudit } from './auditLogService';
import { slugify } from '../utils/slugify';
import type {
  createPriceSchema,
  createProductItemSchema,
  createProductSchema,
  updatePriceSchema,
  updateProductSchema,
} from '../validations/product.validation';
import type { AuditContext } from './questionService';

type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;
type CreatePriceInput = z.infer<typeof createPriceSchema>;
type UpdatePriceInput = z.infer<typeof updatePriceSchema>;
type CreateItemInput = z.infer<typeof createProductItemSchema>;

export async function listProducts(filter: productRepo.ProductFilter = {}) {
  return productRepo.listProducts(filter);
}

export async function getProductOrThrow(id: string) {
  const product = await productRepo.findProductById(id);
  if (!product) {
    throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, 'Product not found', 404);
  }
  return product;
}

export async function getProductDetailOrThrow(id: string) {
  const product = await productRepo.findProductWithDetail(id);
  if (!product) {
    throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, 'Product not found', 404);
  }
  return product;
}

async function ensureSlugAvailable(slug: string, excludeId?: string) {
  const existing = await productRepo.findProductBySlug(slug);
  if (existing && existing.id !== excludeId) {
    throw new AppError(ErrorCode.DUPLICATE_SLUG, `A product with slug "${slug}" already exists`, 409);
  }
}

export async function createProduct(input: CreateProductInput, createdBy: string) {
  const slug = input.slug ?? slugify(input.name);
  await ensureSlugAvailable(slug);

  return productRepo.createProduct({
    name: input.name,
    slug,
    description: input.description ?? null,
    productType: input.productType,
    status: input.status ?? 'DRAFT',
    displayOrder: input.displayOrder ?? 0,
    isActive: input.isActive ?? true,
    createdBy,
  });
}

export async function updateProduct(id: string, input: UpdateProductInput, updatedBy: string) {
  const product = await getProductOrThrow(id);

  const nextSlug = input.slug ?? (input.name ? slugify(input.name) : undefined);
  if (nextSlug && nextSlug !== product.slug) {
    await ensureSlugAvailable(nextSlug, id);
  }

  return productRepo.updateProduct(product, {
    ...input,
    slug: nextSlug ?? product.slug,
    updatedBy,
  });
}

export async function deleteProduct(id: string) {
  const product = await getProductOrThrow(id);
  await productRepo.softDeleteProduct(product);
}

// Prices — spec section 46 / docs/SECURITY.md require an audit trail for
// every product price change.

export async function listPrices(productId: string) {
  await getProductOrThrow(productId);
  return priceRepo.listPrices(productId);
}

export async function createPrice(
  productId: string,
  input: CreatePriceInput,
  actorId: string,
  context: AuditContext = {},
) {
  await getProductOrThrow(productId);

  const price = await priceRepo.createPrice({
    productId,
    currencyCode: input.currencyCode ?? 'INR',
    amount: String(input.amount),
    originalAmount: input.originalAmount !== undefined ? String(input.originalAmount) : null,
    taxAmount: input.taxAmount !== undefined ? String(input.taxAmount) : undefined,
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    isActive: input.isActive ?? true,
  });

  await recordAudit({
    actorId,
    action: 'product.price_changed',
    entityType: 'product_price',
    entityId: price.id,
    afterData: { productId, amount: price.amount, currencyCode: price.currencyCode },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return price;
}

async function getPriceOrThrow(productId: string, priceId: string) {
  const price = await priceRepo.findPriceById(priceId);
  if (!price || price.productId !== productId) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Product price not found', 404);
  }
  return price;
}

export async function updatePrice(
  productId: string,
  priceId: string,
  input: UpdatePriceInput,
  actorId: string,
  context: AuditContext = {},
) {
  const price = await getPriceOrThrow(productId, priceId);
  const beforeData = { amount: price.amount, currencyCode: price.currencyCode, isActive: price.isActive };

  const updated = await priceRepo.updatePrice(price, {
    ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
    ...(input.amount !== undefined ? { amount: String(input.amount) } : {}),
    ...(input.originalAmount !== undefined ? { originalAmount: String(input.originalAmount) } : {}),
    ...(input.taxAmount !== undefined ? { taxAmount: String(input.taxAmount) } : {}),
    ...(input.validFrom !== undefined ? { validFrom: input.validFrom } : {}),
    ...(input.validUntil !== undefined ? { validUntil: input.validUntil } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  });

  await recordAudit({
    actorId,
    action: 'product.price_changed',
    entityType: 'product_price',
    entityId: updated.id,
    beforeData,
    afterData: { amount: updated.amount, currencyCode: updated.currencyCode, isActive: updated.isActive },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return updated;
}

export async function deletePrice(productId: string, priceId: string, actorId: string, context: AuditContext = {}) {
  const price = await getPriceOrThrow(productId, priceId);
  await recordAudit({
    actorId,
    action: 'product.price_changed',
    entityType: 'product_price',
    entityId: price.id,
    beforeData: { amount: price.amount, currencyCode: price.currencyCode },
    afterData: null,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
  await priceRepo.deletePrice(price);
}

// Items — no CHECK-constraint bypass: the DB enforces the target-column/
// access_type match (ADR-018), and this duplicates the same rule at the
// service layer via createProductItemSchema's superRefine, per the spec's
// explicit "validate at the application layer too" requirement.

export async function listItems(productId: string) {
  await getProductOrThrow(productId);
  return productRepo.listItems(productId);
}

export async function createItem(productId: string, input: CreateItemInput) {
  await getProductOrThrow(productId);
  return productRepo.createProductItem({
    productId,
    accessType: input.accessType,
    testId: input.testId ?? null,
    testSeriesId: input.testSeriesId ?? null,
    competitiveExamId: input.competitiveExamId ?? null,
    subjectId: input.subjectId ?? null,
    attemptLimit: input.attemptLimit ?? null,
    accessDurationDays: input.accessDurationDays ?? null,
  });
}

export async function deleteItem(productId: string, itemId: string) {
  const item = await productRepo.findProductItemById(itemId);
  if (!item || item.productId !== productId) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Product item not found', 404);
  }
  await productRepo.deleteProductItem(item);
}
