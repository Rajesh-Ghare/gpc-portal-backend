import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { Product } from '../models';

/** Only ACTIVE, publicly-listed products — mirrors testBrowseService's published-test scoping. */
export async function listActiveProducts() {
  return Product.findAll({
    where: { status: 'ACTIVE', isActive: true },
    include: [{ association: 'prices' }],
    order: [['displayOrder', 'ASC']],
  });
}

export async function getActiveProductOrThrow(id: string) {
  const product = await Product.findOne({
    where: { id, status: 'ACTIVE', isActive: true },
    include: [{ association: 'prices' }, { association: 'items' }],
  });
  if (!product) {
    throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, 'Product not found', 404);
  }
  return product;
}
