import { z } from 'zod';

const mobileNumber = z
  .string()
  .trim()
  .regex(/^[0-9]{10}$/, 'mobileNumber must be a 10-digit number');

const otp = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, 'otp must be a 6-digit number');

const email = z.string().trim().toLowerCase().max(255).pipe(z.email('Enter a valid email address'));

export const requestOtpSchema = z.object({ mobileNumber });

export const verifyOtpSchema = z.object({ mobileNumber, otp });

export const requestEmailOtpSchema = z.object({ email });

export const verifyEmailOtpSchema = z.object({ email, otp });

/** The `credential` (ID token) returned by the Google Identity Services button. */
export const googleSignInSchema = z.object({
  credential: z.string().trim().min(1).max(4096),
});

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().max(150).nullable().optional(),
    contactMobileNumber: z
      .union([mobileNumber, z.literal(''), z.null()])
      .optional(),
  })
  .refine((v) => v.fullName !== undefined || v.contactMobileNumber !== undefined, {
    message: 'Nothing to update',
  });
