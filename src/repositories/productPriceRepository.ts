import type { CreationAttributes, InferAttributes } from 'sequelize';
import { ProductPrice } from '../models';

export async function listPrices(productId: string) {
  return ProductPrice.findAll({ where: { productId }, order: [['createdAt', 'DESC']] });
}

export async function findPriceById(id: string) {
  return ProductPrice.findByPk(id);
}

export async function createPrice(data: CreationAttributes<ProductPrice>) {
  return ProductPrice.create(data);
}

export async function updatePrice(price: ProductPrice, data: Partial<InferAttributes<ProductPrice>>) {
  price.set(data);
  await price.save();
  return price;
}

export async function deletePrice(price: ProductPrice) {
  await price.destroy();
}

export async function findActivePrice(productId: string) {
  const now = new Date();
  const prices = await ProductPrice.findAll({ where: { productId, isActive: true } });
  return (
    prices.find((p) => (!p.validFrom || p.validFrom <= now) && (!p.validUntil || p.validUntil >= now)) ?? null
  );
}
