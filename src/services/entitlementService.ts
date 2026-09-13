import type { z } from 'zod';
import { Op } from 'sequelize';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as entitlementRepo from '../repositories/entitlementRepository';
import * as productRepo from '../repositories/productRepository';
import { getTestOrThrow } from './testService';
import { recordAudit } from './auditLogService';
import { slugify } from '../utils/slugify';
import { ProductItem } from '../models';
import type { grantEntitlementSchema } from '../validations/entitlement.validation';
import type { AuditContext } from './questionService';
import type { Test } from '../models';

type GrantEntitlementInput = z.infer<typeof grantEntitlementSchema>;

/**
 * Finds-or-creates the Product + ProductItem needed to grant access to a
 * single test, reusing one across repeated grants for the same test rather
 * than creating a new product every time. This is intentionally the
 * smallest possible slice of Commerce (Phase 9 owns full product/pricing
 * CRUD) — see ADR-025.
 */
async function resolveIndividualTestProductItem(testId: string, adminId: string) {
  const existing = await productRepo.findIndividualTestProductItem(testId);
  if (existing) return existing;

  const test = await getTestOrThrow(testId);
  const product = await productRepo.createProduct({
    name: `${test.title} — Access`,
    slug: slugify(`test-access-${test.slug}-${Date.now()}`),
    productType: 'INDIVIDUAL_TEST',
    status: 'ACTIVE',
    createdBy: adminId,
  });

  return productRepo.createProductItem({
    productId: product.id,
    testId,
    accessType: 'INDIVIDUAL_TEST',
  });
}

export async function grantEntitlement(input: GrantEntitlementInput, adminId: string, context: AuditContext = {}) {
  const user = await entitlementRepo.findUserById(input.userId);
  if (!user) {
    throw new AppError(ErrorCode.USER_NOT_FOUND, 'User not found', 404);
  }

  let productItem: ProductItem;
  if (input.testId) {
    productItem = await resolveIndividualTestProductItem(input.testId, adminId);
  } else {
    const found = await productRepo.findProductItemById(input.productItemId!);
    if (!found) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Product item not found', 404);
    }
    productItem = found;
  }

  const existingActive = await entitlementRepo.findActiveByUserAndProductItem(input.userId, productItem.id);
  if (existingActive) {
    return { entitlement: existingActive, alreadyExisted: true };
  }

  const entitlement = await entitlementRepo.createEntitlement({
    userId: input.userId,
    productId: productItem.productId,
    productItemId: productItem.id,
    attemptLimit: input.attemptLimit ?? null,
    validFrom: input.validFrom ?? new Date(),
    validUntil: input.validUntil ?? null,
    grantedBy: adminId,
    metadata: { source: 'ADMIN_GRANT', reason: input.reason ?? null },
  });

  await recordAudit({
    actorId: adminId,
    action: 'entitlement.grant',
    entityType: 'entitlement',
    entityId: entitlement.id,
    afterData: {
      userId: input.userId,
      productItemId: productItem.id,
      attemptLimit: entitlement.attemptLimit,
      validFrom: entitlement.validFrom,
      validUntil: entitlement.validUntil,
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return { entitlement, alreadyExisted: false };
}

/**
 * Resolves which product_items would grant access to a given test —
 * INDIVIDUAL_TEST (exact match), EXAM_PACKAGE (same competitive exam),
 * TEST_SERIES (same series, if any), or a blanket SUBSCRIPTION/ALL_ACCESS
 * item (no target columns) — then checks for an active entitlement against
 * any of them. SUBJECT_PACKAGE is deliberately not resolved here: a test
 * can span multiple subjects, so "does this test belong to that subject
 * package" has no unambiguous answer — see docs/KNOWN_ISSUES.md.
 */
export async function findActiveEntitlementForTest(userId: string, test: Test) {
  const candidates = await ProductItem.findAll({
    where: {
      [Op.or]: [
        { accessType: 'INDIVIDUAL_TEST', testId: test.id },
        { accessType: 'EXAM_PACKAGE', competitiveExamId: test.competitiveExamId },
        ...(test.testSeriesId ? [{ accessType: 'TEST_SERIES', testSeriesId: test.testSeriesId }] : []),
        { accessType: { [Op.in]: ['SUBSCRIPTION', 'ALL_ACCESS'] } },
      ],
    },
  });

  if (candidates.length === 0) return null;
  return entitlementRepo.findActiveByUserAndProductItemIds(
    userId,
    candidates.map((c) => c.id),
  );
}
