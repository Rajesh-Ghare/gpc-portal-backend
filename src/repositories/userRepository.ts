import { Op } from 'sequelize';
import type { InferAttributes } from 'sequelize';
import { Role, User } from '../models';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByMobileNumber(mobileNumber: string) {
  return User.findOne({ where: { mobileNumber } });
}

export async function findUserByEmail(email: string) {
  return User.findOne({ where: { email: normalizeEmail(email) } });
}

export async function findUserByGoogleSub(googleSub: string) {
  return User.findOne({ where: { googleSub } });
}

export async function findUserById(id: string) {
  return User.findByPk(id, { include: [{ association: 'roles' }] });
}

async function assignStudentRole(user: User) {
  const studentRole = await Role.findOne({ where: { code: 'STUDENT' } });
  if (studentRole) {
    await user.addRole(studentRole);
  }
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
  await assignStudentRole(user);
  return { user, created: true };
}

/**
 * Same self-registration rule for email (ADR-040). Only call after the
 * caller has *proven* ownership of the address (OTP verified, or Google
 * says email_verified) — this marks it verified.
 */
export async function findOrCreateUserByVerifiedEmail(email: string, defaults: { fullName?: string | null } = {}) {
  const normalized = normalizeEmail(email);
  const existing = await findUserByEmail(normalized);
  if (existing) {
    return { user: existing, created: false };
  }

  const user = await User.create({
    email: normalized,
    isEmailVerified: true,
    fullName: defaults.fullName ?? null,
    mobileNumber: null,
    contactMobileNumber: null,
    googleSub: null,
  });
  await assignStudentRole(user);
  return { user, created: true };
}

export async function updateUser(user: User, data: Partial<InferAttributes<User>>) {
  user.set(data);
  await user.save();
  return user;
}

/**
 * Looks up students by mobile number, email or name — used by the admin
 * entitlement-grant UI (Phase 13) to find a userId. Scoped to users with
 * the STUDENT role; capped at 20 results (a picker, not a full directory).
 */
export async function searchStudents(query?: string) {
  return User.findAll({
    where: query
      ? {
          [Op.or]: [
            { mobileNumber: { [Op.iLike]: `%${query}%` } },
            { email: { [Op.iLike]: `%${query}%` } },
            { fullName: { [Op.iLike]: `%${query}%` } },
          ],
        }
      : {},
    include: [{ association: 'roles', where: { code: 'STUDENT' }, required: true, attributes: [] }],
    order: [['createdAt', 'DESC']],
    limit: 20,
  });
}
