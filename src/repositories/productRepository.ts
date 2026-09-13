import type { CreationAttributes } from 'sequelize';
import { Product, ProductItem } from '../models';

/**
 * Minimal — only what the Phase 7 admin entitlement-grant flow needs.
 * Full product/pricing CRUD belongs to Commerce (Phase 9); this file is
 * intentionally narrow so Phase 9 can extend it without replacing it.
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
