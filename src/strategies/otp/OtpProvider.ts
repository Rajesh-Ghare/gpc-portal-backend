export interface OtpSendResult {
  providerRequestId?: string;
}

export interface OtpProvider {
  send(mobileNumber: string, otp: string): Promise<OtpSendResult>;
}
