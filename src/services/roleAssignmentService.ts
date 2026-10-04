import { Role, User, UserRole, sequelize } from '../models';
import { normalizeEmail } from '../repositories/userRepository';
import { recordAudit } from './auditLogService';

export interface GrantRoleResult {
  userId: string;
  email: string;
  roleCode: string;
  userCreated: boolean;
  roleAdded: boolean;
}

/**
 * Operator tool (run via `npm run user:grant-role`, never an HTTP endpoint):
 * gives the account with this email a role, creating the account if it
 * doesn't exist yet. The email is not marked verified — the person proves
 * ownership the first time they sign in with Google or an email code, and
 * only then can they use the role. Idempotent; audited as `role.grant`
 * with no actor (ADR-040).
 */
export async function grantRoleByEmail(email: string, roleCode: string): Promise<GrantRoleResult> {
  const normalized = normalizeEmail(email);

  return sequelize.transaction(async (transaction) => {
    const role = await Role.findOne({ where: { code: roleCode }, transaction });
    if (!role) {
      const codes = (await Role.findAll({ attributes: ['code'], transaction })).map((r) => r.code);
      throw new Error(`Unknown role "${roleCode}". Available: ${codes.join(', ')}`);
    }

    let user = await User.findOne({ where: { email: normalized }, transaction });
    const userCreated = !user;
    user ??= await User.create(
      { email: normalized, mobileNumber: null, contactMobileNumber: null, googleSub: null, fullName: null },
      { transaction },
    );

    const existing = await UserRole.findOne({ where: { userId: user.id, roleId: role.id }, transaction });
    if (!existing) {
      await UserRole.create({ userId: user.id, roleId: role.id }, { transaction });
      await recordAudit(
        {
          actorId: null,
          action: 'role.grant',
          entityType: 'user',
          entityId: user.id,
          afterData: { email: normalized, roleCode, source: 'cli' },
        },
        transaction,
      );
    }

    return { userId: user.id, email: normalized, roleCode, userCreated, roleAdded: !existing };
  });
}
