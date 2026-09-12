import type { Session, User } from '../models';

declare global {
  namespace Express {
    interface Request {
      currentUser?: User;
      currentSession?: Session;
    }
  }
}

export {};
