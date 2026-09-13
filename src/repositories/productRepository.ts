import type { CreationAttributes, InferAttributes } from 'sequelize';
import { Product, ProductItem } from '../models';

/**
 * findIndividualTestProductItem/createProduct/createProductItem/
 * findProductItemById predate this phase (Phase 7, ADR-025) — kept as-is
 * since entitlementService already depends on them. Everything below is
 * Phase 9's full admin product/item CRUD.
 */
export async function findIndividualTestProductItem(testId: string) {
  return ProductItem.findOne({ where: { testId, accessType: 'INDIVIDUAL_TEST' } });
}

export async function createProduct(data: CreationAttributes<Product>) {
  return Product.create(data);
}

export async function createProductItem(data: CreationAttributes<ProductItem>) {
  return ProductItem.create(data);
}

export async function findProductItemById(id: string) {
  return ProductItem.findByPk(id);
}

export interface ProductFilter {
  productType?: string;
  status?: string;
  isActive?: boolean;
}

export async function listProducts(filter: ProductFilter = {}) {
  const where: Record<string, unknown> = {};
  if (filter.productType) where.productType = filter.productType;
  if (filter.status) where.status = filter.status;
  if (filter.isActive !== undefined) where.isActive = filter.isActive;

  return Product.findAll({ where, order: [['displayOrder', 'ASC']] });
}

export async function findProductById(id: string) {
  return Product.findByPk(id);
}

export async function findProductWithDetail(id: string) {
  return Product.findByPk(id, { include: [{ association: 'prices' }, { association: 'items' }] });
}

export async function findProductBySlug(slug: string) {
  return Product.findOne({ where: { slug } });
}

export async function updateProduct(product: Product, data: Partial<InferAttributes<Product>>) {
  product.set(data);
  await product.save();
  return product;
}

export async function softDeleteProduct(product: Product) {
  await product.destroy();
}

export async function listItems(productId: string) {
  return ProductItem.findAll({ where: { productId }, order: [['createdAt', 'ASC']] });
}

export async function deleteProductItem(item: ProductItem) {
  await item.destroy();
}
