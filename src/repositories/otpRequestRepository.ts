import { Op } from 'sequelize';
import type { Transaction } from 'sequelize';
import { OtpRequest, sequelize } from '../models';
import { acquireTransactionLock } from './lockRepository';

export interface CreateOtpRequestInput {
  mobileNumber: string;
  purpose: string;
  otpHash: string;
  expiresAt: Date;
  provider: string;
  providerRequestId?: string;
  requestIp?: string | null;
}

export async function createOtpRequest(input: CreateOtpRequestInput, transaction?: Transaction) {
  return OtpRequest.create(
    {
      mobileNumber: input.mobileNumber,
      purpose: input.purpose,
      otpHash: input.otpHash,
      expiresAt: input.expiresAt,
      provider: input.provider,
      providerRequestId: input.providerRequestId ?? null,
      requestIp: input.requestIp ?? null,
    },
    { transaction },
  );
}

/**
 * Serializes OTP request/verify work per key (e.g. one mobile number) for
 * the rest of the transaction — this is what makes the count-then-insert
 * rate-limit checks race-free.
 */
export async function lockOtpKey(key: string, transaction: Transaction) {
  await acquireTransactionLock(key, transaction);
}

/** Most recent unverified, unexpired OTP request for a mobile number/purpose. */
export async function findActiveOtpRequest(mobileNumber: string, purpose: string, transaction?: Transaction) {
  return OtpRequest.findOne({
    where: {
      mobileNumber,
      purpose,
      verifiedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
    order: [['createdAt', 'DESC']],
    transaction,
  });
}

export async function findLatestOtpRequest(mobileNumber: string, purpose: string, transaction?: Transaction) {
  return OtpRequest.findOne({
    where: { mobileNumber, purpose },
    order: [['createdAt', 'DESC']],
    transaction,
  });
}

/** Requests in the window, oldest first — only the columns rate limiting needs. */
export async function listRecentOtpRequestsForMobile(
  mobileNumber: string,
  purpose: string,
  since: Date,
  transaction?: Transaction,
) {
  return OtpRequest.findAll({
    attributes: ['createdAt', 'attemptCount'],
    where: { mobileNumber, purpose, createdAt: { [Op.gte]: since } },
    order: [['createdAt', 'ASC']],
    transaction,
  });
}

export async function listRecentOtpRequestsForIp(requestIp: string, since: Date, transaction?: Transaction) {
  return OtpRequest.findAll({
    attributes: ['createdAt'],
    where: { requestIp, createdAt: { [Op.gte]: since } },
    order: [['createdAt', 'ASC']],
    transaction,
  });
}

/**
 * Atomically consumes one verify attempt, only if the cap isn't reached yet.
 * Counted *before* the (slow) hash check, so parallel guesses can never
 * exceed `maxAttempts` the way a read-check-then-increment could.
 */
export async function claimOtpAttempt(id: string, maxAttempts: number, transaction?: Transaction) {
  const [affected] = await OtpRequest.update(
    { attemptCount: sequelize.literal('attempt_count + 1') },
    { where: { id, attemptCount: { [Op.lt]: maxAttempts } }, transaction },
  );
  return affected === 1;
}

/** Marks the OTP used; false if another request already used it (single-use under concurrency). */
export async function consumeOtpRequest(id: string) {
  const [affected] = await OtpRequest.update({ verifiedAt: new Date() }, { where: { id, verifiedAt: null } });
  return affected === 1;
}

export async function setProviderRequestId(otpRequest: OtpRequest, providerRequestId: string | undefined) {
  otpRequest.providerRequestId = providerRequestId ?? null;
  await otpRequest.save();
  return otpRequest;
}

/** Used when the provider fails to send: the row still counts toward rate limits but can't be verified. */
export async function expireOtpRequest(otpRequest: OtpRequest) {
  otpRequest.expiresAt = new Date();
  await otpRequest.save();
  return otpRequest;
}
