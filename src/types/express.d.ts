import type { Session, User } from '../models';

declare global {
  namespace Express {
    interface Request {
      currentUser?: User;
      currentSession?: Session;
      /** Exact request bytes, kept by express.json() — webhook signatures are computed over these. */
      rawBody?: Buffer;
    }
  }
}

export {};
