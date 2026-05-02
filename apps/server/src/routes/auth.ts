import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { loginLimiter } from '../middleware/rateLimit';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const accessTokenExpiresIn: SignOptions['expiresIn'] =
  (process.env.JWT_EXPIRES_IN as SignOptions['expiresIn']) || '1h';
const refreshTokenExpiresIn: SignOptions['expiresIn'] =
  (process.env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn']) || '7d';

router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = loginSchema.parse(req.body);

    const admin = await prisma.admin.findUnique({
      where: { email: body.email },
    });

    if (!admin) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await bcrypt.compare(body.password, admin.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET!;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;

    const accessToken = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role },
      jwtSecret,
      { expiresIn: accessTokenExpiresIn }
    );

    const refreshToken = jwt.sign(
      { adminId: admin.id, type: 'refresh' },
      jwtRefreshSecret,
      { expiresIn: refreshTokenExpiresIn }
    );

    await prisma.admin.update({
      where: { id: admin.id },
      data: { isOnline: true, lastSeenAt: new Date() },
    });

    logger.info('Admin logged in', { adminId: admin.id, email: admin.email });

    res.json({
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        avatar: admin.avatar,
        role: admin.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Login error', { error });
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = refreshSchema.parse(req.body);

    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;
    const decoded = jwt.verify(body.refreshToken, jwtRefreshSecret) as {
      adminId: string;
      type: string;
    };

    if (decoded.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId },
    });

    if (!admin) {
      res.status(401).json({ error: 'Admin not found' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET!;
    const accessToken = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role },
      jwtSecret,
      { expiresIn: accessTokenExpiresIn }
    );

    res.json({ accessToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Refresh token expired' });
      return;
    }
    logger.error('Token refresh error', { error });
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', authMiddleware(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.admin) {
      await prisma.admin.update({
        where: { id: req.admin.id },
        data: { isOnline: false, lastSeenAt: new Date() },
      });
    }
    res.json({ message: 'Logged out' });
  } catch (error) {
    logger.error('Logout error', { error });
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/me', authMiddleware(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isOnline: true,
        createdAt: true,
      },
    });
    res.json(admin);
  } catch (error) {
    logger.error('Get profile error', { error });
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.post('/change-password', authMiddleware(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = changePasswordSchema.parse(req.body);

    if (body.currentPassword === body.newPassword) {
      res.status(400).json({ error: 'New password must be different from current password' });
      return;
    }

    const admin = await prisma.admin.findUnique({
      where: { id: req.admin!.id },
      select: { id: true, passwordHash: true },
    });

    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }

    const isValidCurrent = await bcrypt.compare(body.currentPassword, admin.passwordHash);
    if (!isValidCurrent) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Change password error', { error, adminId: req.admin?.id });
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
