import { randomBytes } from 'crypto';
import type { z } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { sequelize } from '../models';
import * as orderRepo from '../repositories/orderRepository';
import * as productRepo from '../repositories/productRepository';
import * as priceRepo from '../repositories/productPriceRepository';
import type { createOrderSchema } from '../validations/order.validation';

type CreateOrderInput = z.infer<typeof createOrderSchema>;

function generateOrderNumber() {
  return `ORD-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * Creates a PENDING order for a single product, snapshotting its name and
 * current active price into one order_item row (never re-read live at
 * payment time — see docs/COMMERCE_AND_PAYMENTS.md). Idempotent on
 * (userId, idempotencyKey): a retried request with the same key and product
 * returns the existing order; the same key with a different product is a
 * client bug and rejected as IDEMPOTENCY_CONFLICT.
 */
export async function createOrder(input: CreateOrderInput, userId: string) {
  const existing = await orderRepo.findByUserAndIdempotencyKey(userId, input.idempotencyKey);
  if (existing) {
    const matchesProduct = existing.items?.some((item) => item.productId === input.productId);
    if (!matchesProduct) {
      throw new AppError(ErrorCode.IDEMPOTENCY_CONFLICT, 'Idempotency key already used for a different order', 409);
    }
    return { order: existing, alreadyExisted: true };
  }

  const product = await productRepo.findProductById(input.productId);
  if (!product || product.status !== 'ACTIVE' || !product.isActive) {
    throw new AppError(ErrorCode.PRODUCT_NOT_FOUND, 'Product not found or not available for purchase', 404);
  }

  const price = await priceRepo.findActivePrice(product.id);
  if (!price) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Product has no active price', 404);
  }

  const subtotal = Number(price.amount);
  const tax = Number(price.taxAmount);
  const total = subtotal + tax;

  const order = await sequelize.transaction(async (transaction) => {
    const created = await orderRepo.createOrder(
      {
        userId,
        orderNumber: generateOrderNumber(),
        status: 'PENDING',
        currencyCode: price.currencyCode,
        subtotalAmount: String(subtotal),
        discountAmount: '0',
        taxAmount: String(tax),
        totalAmount: String(total),
        idempotencyKey: input.idempotencyKey,
      },
      transaction,
    );

    await orderRepo.createOrderItem(
      {
        orderId: created.id,
        productId: product.id,
        productItemId: null,
        productName: product.name,
        unitPrice: price.amount,
        currencyCode: price.currencyCode,
        quantity: 1,
        subtotalAmount: String(subtotal),
      },
      transaction,
    );

    return created;
  });

  const detail = await orderRepo.findOrderById(order.id);
  return { order: detail!, alreadyExisted: false };
}

export async function getOrderOrThrow(id: string) {
  const order = await orderRepo.findOrderById(id);
  if (!order) {
    throw new AppError(ErrorCode.ORDER_NOT_FOUND, 'Order not found', 404);
  }
  return order;
}

export async function listMyOrders(userId: string) {
  return orderRepo.listOrders({ userId });
}

export async function listOrdersForAdmin(filter: orderRepo.OrderFilter = {}) {
  return orderRepo.listOrders(filter);
}
