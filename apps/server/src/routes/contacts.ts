import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

const router = Router();

router.use(authMiddleware());

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { displayName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          platformLinks: true,
          tags: { include: { tag: true } },
          _count: { select: { conversations: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit as string, 10),
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({
      contacts,
      pagination: {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string, 10)),
      },
    });
  } catch (error) {
    logger.error('List contacts error', { error });
    res.status(500).json({ error: 'Failed to list contacts' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        platformLinks: true,
        tags: { include: { tag: true } },
        conversations: {
          include: {
            messages: { take: 1, orderBy: { sentAt: 'desc' } },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.json(contact);
  } catch (error) {
    logger.error('Get contact error', { error });
    res.status(500).json({ error: 'Failed to get contact' });
  }
});

const updateContactSchema = z.object({
  displayName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  notes: z.string().optional(),
});

router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = updateContactSchema.parse(req.body);
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data,
      include: { platformLinks: true, tags: { include: { tag: true } } },
    });
    res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Update contact error', { error });
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

const contactTagSchema = z.object({
  tagId: z.string().cuid(),
});

router.post('/:id/tags', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = contactTagSchema.parse(req.body);
    const tag = await prisma.contactTag.create({
      data: { contactId: req.params.id, tagId: data.tagId },
      include: { tag: true },
    });
    res.json(tag);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Add contact tag error', { error });
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

router.delete('/:id/tags/:tagId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.contactTag.delete({
      where: {
        contactId_tagId: { contactId: req.params.id, tagId: req.params.tagId },
      },
    });
    res.json({ message: 'Tag removed' });
  } catch (error) {
    logger.error('Remove contact tag error', { error });
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

export default router;
