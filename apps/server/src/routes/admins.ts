import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { authMiddleware, requireSuperAdmin, AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

const router = Router();

router.use(authMiddleware());

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(admins);
  } catch (error) {
    logger.error('List admins error', { error });
    res.status(500).json({ error: 'Failed to list admins' });
  }
});

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'AGENT']).default('AGENT'),
});

router.post('/', requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createAdminSchema.parse(req.body);

    const existing = await prisma.admin.findUnique({ where: { email: data.email } });
    if (existing) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const admin = await prisma.admin.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    res.status(201).json(admin);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Create admin error', { error });
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

const updateAdminSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'AGENT']).optional(),
  password: z.string().min(8).optional(),
});

router.put('/:id', requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = updateAdminSchema.parse(req.body);

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 12);

    const admin = await prisma.admin.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    res.json(admin);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Update admin error', { error });
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

router.delete('/:id', requireSuperAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.admin?.id === req.params.id) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }

    await prisma.admin.delete({ where: { id: req.params.id } });
    res.json({ message: 'Admin deleted' });
  } catch (error) {
    logger.error('Delete admin error', { error });
    res.status(500).json({ error: 'Failed to delete admin' });
  }
});

export default router;
