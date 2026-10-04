import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/errorCodes';

export interface GoogleIdentity {
  /** Stable Google account id — survives email address changes. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

/**
 * Verifies a Google Identity Services ID token (the `credential` the
 * browser button returns): signature against Google's public keys, issuer,
 * expiry, and — critically — that it was issued for *our* client id
 * (audience). A token minted for another site is rejected. No client
 * secret is involved in this flow.
 */
export class GoogleAuthLibraryVerifier implements GoogleTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly clientId: string) {}

  async verify(idToken: string): Promise<GoogleIdentity> {
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
      payload = ticket.getPayload();
    } catch {
      throw new AppError(ErrorCode.AUTH_GOOGLE_INVALID, 'Google sign-in could not be verified. Please try again.', 401);
    }
    if (!payload?.sub || !payload.email) {
      throw new AppError(ErrorCode.AUTH_GOOGLE_INVALID, 'Google did not return an email address for this account.', 401);
    }
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
    };
  }
}

let verifier: GoogleTokenVerifier | null = null;

export function getGoogleTokenVerifier(): GoogleTokenVerifier {
  verifier ??= new GoogleAuthLibraryVerifier(env.google.clientId);
  return verifier;
}
