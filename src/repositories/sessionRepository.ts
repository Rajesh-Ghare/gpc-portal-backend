import { Op } from 'sequelize';
import { Session } from '../models';

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function createSession(input: CreateSessionInput) {
  return Session.create({
    userId: input.userId,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}

export async function findActiveSessionByTokenHash(tokenHash: string) {
  return Session.findOne({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
  });
}

export async function revokeSession(session: Session) {
  session.revokedAt = new Date();
  await session.save();
  return session;
}
