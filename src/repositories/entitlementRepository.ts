import { Op } from 'sequelize';
import type { CreationAttributes, Transaction } from 'sequelize';
import { Entitlement, User } from '../models';

export async function findActiveByUserAndProductItem(userId: string, productItemId: string, transaction?: Transaction) {
  return Entitlement.findOne({
    transaction,
    where: {
      userId,
      productItemId,
      status: 'ACTIVE',
      revokedAt: null,
      [Op.and]: [
        { [Op.or]: [{ validFrom: null }, { validFrom: { [Op.lte]: new Date() } }] },
        { [Op.or]: [{ validUntil: null }, { validUntil: { [Op.gte]: new Date() } }] },
      ],
    },
  });
}

/**
 * All of a user's currently-active entitlements for these product items.
 * With `lock`, row-locks them FOR UPDATE in a fixed (id) order, so two
 * transactions locking overlapping sets can never deadlock.
 */
export async function listActiveByUserAndProductItemIds(
  userId: string,
  productItemIds: string[],
  options: { transaction?: Transaction; lock?: boolean } = {},
) {
  if (productItemIds.length === 0) return [];
  const { transaction, lock } = options;
  return Entitlement.findAll({
    transaction,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
    order: [['id', 'ASC']],
    where: {
      userId,
      productItemId: { [Op.in]: productItemIds },
      status: 'ACTIVE',
      revokedAt: null,
      [Op.and]: [
        { [Op.or]: [{ validFrom: null }, { validFrom: { [Op.lte]: new Date() } }] },
        { [Op.or]: [{ validUntil: null }, { validUntil: { [Op.gte]: new Date() } }] },
      ],
    },
  });
}

export async function createEntitlement(data: CreationAttributes<Entitlement>, transaction?: Transaction) {
  return Entitlement.create(data, { transaction });
}

/** A single `SET attempts_used = attempts_used + 1` — call with the row already locked in `transaction`. */
export async function incrementAttemptsUsed(entitlement: Entitlement, transaction: Transaction) {
  await entitlement.increment('attemptsUsed', { by: 1, transaction });
  return entitlement;
}

export async function findUserById(id: string) {
  return User.findByPk(id);
}

export interface EntitlementFilter {
  userId?: string;
  status?: string;
  productId?: string;
}

export async function listEntitlements(filter: EntitlementFilter = {}) {
  const where: Record<string, unknown> = {};
  if (filter.userId) where.userId = filter.userId;
  if (filter.status) where.status = filter.status;
  if (filter.productId) where.productId = filter.productId;

  return Entitlement.findAll({
    where,
    include: [{ association: 'product' }, { association: 'productItem' }, { association: 'user' }],
    order: [['createdAt', 'DESC']],
  });
}

export async function findEntitlementById(id: string) {
  return Entitlement.findByPk(id, {
    include: [{ association: 'product' }, { association: 'productItem' }, { association: 'user' }],
  });
}

export async function revokeEntitlement(entitlement: Entitlement) {
  entitlement.status = 'REVOKED';
  entitlement.revokedAt = new Date();
  await entitlement.save();
  return entitlement;
}
