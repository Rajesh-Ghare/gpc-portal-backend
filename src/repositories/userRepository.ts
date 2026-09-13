import { Op } from 'sequelize';
import { Role, User } from '../models';

export async function findUserByMobileNumber(mobileNumber: string) {
  return User.findOne({ where: { mobileNumber } });
}

export async function findUserById(id: string) {
  return User.findByPk(id, { include: [{ association: 'roles' }] });
}

/**
 * Finds an existing user by mobile number, or creates one and assigns the
 * default STUDENT role — students self-register via OTP login (spec section
 * 3); there is no separate signup step.
 */
export async function findOrCreateUserByMobileNumber(mobileNumber: string) {
  const existing = await findUserByMobileNumber(mobileNumber);
  if (existing) {
    return { user: existing, created: false };
  }

  const user = await User.create({ mobileNumber, isMobileVerified: true });
  const studentRole = await Role.findOne({ where: { code: 'STUDENT' } });
  if (studentRole) {
    await user.addRole(studentRole);
  }
  return { user, created: true };
}

/**
 * Looks up students by mobile number or name — used by the admin
 * entitlement-grant UI (Phase 13) to find a userId, since there was
 * previously no way to search for one at all. Scoped to users with the
 * STUDENT role; capped at 20 results (a picker, not a full directory).
 */
export async function searchStudents(query?: string) {
  return User.findAll({
    where: query
      ? {
          [Op.or]: [{ mobileNumber: { [Op.iLike]: `%${query}%` } }, { fullName: { [Op.iLike]: `%${query}%` } }],
        }
      : {},
    include: [{ association: 'roles', where: { code: 'STUDENT' }, required: true, attributes: [] }],
    order: [['createdAt', 'DESC']],
    limit: 20,
  });
}
