import type { CreationAttributes, Transaction } from 'sequelize';
import { Order, OrderItem } from '../models';

export async function findByUserAndIdempotencyKey(userId: string, idempotencyKey: string) {
  return Order.findOne({ where: { userId, idempotencyKey }, include: [{ association: 'items' }] });
}

export async function createOrder(data: CreationAttributes<Order>, transaction: Transaction) {
  return Order.create(data, { transaction });
}

export async function createOrderItem(data: CreationAttributes<OrderItem>, transaction: Transaction) {
  return OrderItem.create(data, { transaction });
}

export async function findOrderById(id: string) {
  return Order.findByPk(id, { include: [{ association: 'items' }] });
}

export interface OrderFilter {
  userId?: string;
  status?: string;
}

export async function listOrders(filter: OrderFilter = {}) {
  const where: Record<string, unknown> = {};
  if (filter.userId) where.userId = filter.userId;
  if (filter.status) where.status = filter.status;

  return Order.findAll({
    where,
    include: [{ association: 'items' }],
    order: [['createdAt', 'DESC']],
  });
}
