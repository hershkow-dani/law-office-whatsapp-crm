import type { SessionPayload } from '../engine/auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: SessionPayload;
    }
  }
}

export {};
