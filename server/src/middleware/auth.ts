import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth';

export interface AuthRequest extends Request {
  userId?: number;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  const token = header.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Token inválido o expirado' });
    return;
  }
  req.userId = payload.id;
  next();
}
