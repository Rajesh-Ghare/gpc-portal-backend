import { z } from 'zod';

export const requestOtpSchema = z.object({
  mobileNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'mobileNumber must be a 10-digit number'),
});

export const verifyOtpSchema = z.object({
  mobileNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'mobileNumber must be a 10-digit number'),
  otp: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'otp must be a 6-digit number'),
});
