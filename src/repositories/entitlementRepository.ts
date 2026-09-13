import { Op } from 'sequelize';
import type { CreationAttributes } from 'sequelize';
import { Entitlement, User } from '../models';

export async function findActiveByUserAndProductItem(userId: string, productItemId: string) {
  return Entitlement.findOne({
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

export async function findActiveByUserAndProductItemIds(userId: string, productItemIds: string[]) {
  if (productItemIds.length === 0) return null;
  return Entitlement.findOne({
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

export async function createEntitlement(data: CreationAttributes<Entitlement>) {
  return Entitlement.create(data);
}

export async function incrementAttemptsUsed(entitlement: Entitlement) {
  entitlement.attemptsUsed += 1;
  await entitlement.save();
  return entitlement;
}

export async function findUserById(id: string) {
  return User.findByPk(id);
}
