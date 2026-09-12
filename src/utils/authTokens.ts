import argon2 from 'argon2';
import { randomBytes, randomInt, createHash } from 'crypto';

/**
 * OTPs are hashed with argon2 (slow, salted) rather than a fast hash.
 * Unlike a session token, an OTP is drawn from a tiny keyspace (6 digits =
 * 1,000,000 possibilities) and verified only a handful of times per
 * lifecycle, so the cost of argon2 is negligible but it meaningfully raises
 * the bar against offline brute-forcing if `otp_hash` is ever exposed.
 */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function hashOtp(otp: string): Promise<string> {
  return argon2.hash(otp);
}

export async function verifyOtp(hash: string, otp: string): Promise<boolean> {
  return argon2.verify(hash, otp);
}

/**
 * Session tokens are hashed with a fast, unsalted SHA-256 digest. This is
 * safe here specifically because the raw token is 256 bits of random
 * entropy (not a small/guessable value like a password or OTP) — the digest
 * only needs to support a fast equality lookup on every authenticated
 * request, not resist brute-forcing a small keyspace. See
 * docs/DECISIONS.md ADR-020.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
