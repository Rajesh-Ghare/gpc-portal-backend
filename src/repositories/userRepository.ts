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
