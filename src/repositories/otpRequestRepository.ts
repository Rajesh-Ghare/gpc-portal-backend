import { Op } from 'sequelize';
import { OtpRequest } from '../models';

export interface CreateOtpRequestInput {
  mobileNumber: string;
  purpose: string;
  otpHash: string;
  expiresAt: Date;
  provider: string;
  providerRequestId?: string;
  requestIp?: string | null;
}

export async function createOtpRequest(input: CreateOtpRequestInput) {
  return OtpRequest.create({
    mobileNumber: input.mobileNumber,
    purpose: input.purpose,
    otpHash: input.otpHash,
    expiresAt: input.expiresAt,
    provider: input.provider,
    providerRequestId: input.providerRequestId ?? null,
    requestIp: input.requestIp ?? null,
  });
}

/** Most recent unverified, unexpired OTP request for a mobile number/purpose. */
export async function findActiveOtpRequest(mobileNumber: string, purpose: string) {
  return OtpRequest.findOne({
    where: {
      mobileNumber,
      purpose,
      verifiedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
    order: [['createdAt', 'DESC']],
  });
}

export async function incrementOtpAttempt(otpRequest: OtpRequest) {
  otpRequest.attemptCount += 1;
  await otpRequest.save();
  return otpRequest;
}

export async function markOtpVerified(otpRequest: OtpRequest) {
  otpRequest.verifiedAt = new Date();
  await otpRequest.save();
  return otpRequest;
}
