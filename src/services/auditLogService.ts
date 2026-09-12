import { AuditLog } from '../models';

export interface RecordAuditInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Per spec section 46, only specific administrative actions require an
 * audit trail (question approval/rejection, question version changes, test
 * publish/close, price changes, entitlement changes, result release,
 * role/permission changes, admin overrides) — call this explicitly from
 * those service methods, not from every write.
 */
export async function recordAudit(input: RecordAuditInput) {
  await AuditLog.create({
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeData: input.beforeData ?? null,
    afterData: input.afterData ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}
