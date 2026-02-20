import { Request, Response, NextFunction } from 'express';
import { getFlag } from '../lib/featureFlags';
import { AuthRequest } from './auth';

export function requireFlag(flagKey: string, defaultValue: boolean = false) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;
    const context = {
      kind: 'user' as const,
      key: authReq.userId ? String(authReq.userId) : 'anonymous',
    };

    const enabled = await getFlag(flagKey, context, defaultValue);

    if (!enabled) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    next();
  };
}
