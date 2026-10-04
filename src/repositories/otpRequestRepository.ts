import { Op } from 'sequelize';
import type { Transaction } from 'sequelize';
import { OtpRequest, sequelize, type OtpChannel } from '../models';
import { acquireTransactionLock } from './lockRepository';

/** Where an OTP is sent: a mobile number (SMS) or an email address (EMAIL, lowercase). */
export interface OtpDestination {
  channel: OtpChannel;
  value: string;
}

function destinationWhere(destination: OtpDestination) {
  return destination.channel === 'SMS'
    ? { channel: 'SMS' as const, mobileNumber: destination.value }
    : { channel: 'EMAIL' as const, email: destination.value };
}

export interface CreateOtpRequestInput {
  destination: OtpDestination;
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
      ...destinationWhere(input.destination),
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
 * Serializes OTP request/verify work per key (e.g. one mobile number or
 * email) for the rest of the transaction — this is what makes the
 * count-then-insert rate-limit checks race-free.
 */
export async function lockOtpKey(key: string, transaction: Transaction) {
  await acquireTransactionLock(key, transaction);
}

/** Most recent unverified, unexpired OTP request for a destination/purpose. */
export async function findActiveOtpRequest(destination: OtpDestination, purpose: string, transaction?: Transaction) {
  return OtpRequest.findOne({
    where: {
      ...destinationWhere(destination),
      purpose,
      verifiedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
    order: [['createdAt', 'DESC']],
    transaction,
  });
}

export async function findLatestOtpRequest(destination: OtpDestination, purpose: string, transaction?: Transaction) {
  return OtpRequest.findOne({
    where: { ...destinationWhere(destination), purpose },
    order: [['createdAt', 'DESC']],
    transaction,
  });
}

/** Requests in the window, oldest first — only the columns rate limiting needs. */
export async function listRecentOtpRequestsForDestination(
  destination: OtpDestination,
  purpose: string,
  since: Date,
  transaction?: Transaction,
) {
  return OtpRequest.findAll({
    attributes: ['createdAt', 'attemptCount'],
    where: { ...destinationWhere(destination), purpose, createdAt: { [Op.gte]: since } },
    order: [['createdAt', 'ASC']],
    transaction,
  });
}

/** Across both channels — the per-IP cap limits total code sends from one network. */
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
