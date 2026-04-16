import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

export interface AuthRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

export function authMiddleware(requiredRoles?: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7);
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('JWT_SECRET not configured');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      const decoded = jwt.verify(token, jwtSecret) as {
        adminId: string;
        email: string;
        role: string;
      };

      const admin = await prisma.admin.findUnique({
        where: { id: decoded.adminId },
        select: { id: true, email: true, role: true, name: true },
      });

      if (!admin) {
        res.status(401).json({ error: 'Admin not found' });
        return;
      }

      if (requiredRoles && !requiredRoles.includes(admin.role)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      req.admin = admin;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({ error: 'Token expired' });
        return;
      }
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
      logger.error('Auth middleware error', { error });
      res.status(500).json({ error: 'Authentication failed' });
    }
  };
}

export const requireSuperAdmin = authMiddleware(['SUPER_ADMIN']);
export const requireAdmin = authMiddleware(['SUPER_ADMIN', 'ADMIN']);
export const requireAgent = authMiddleware(['SUPER_ADMIN', 'ADMIN', 'AGENT']);
