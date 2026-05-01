import { Router, Response } from 'express';
import { z } from 'zod';
import { ConversationService } from '../services/ConversationService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import prisma from '../lib/prisma';
import { getSocketIO } from '../lib/socket';

const router = Router();

router.use(authMiddleware());

const querySchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'SNOOZED']).optional(),
  platform: z.enum(['LINE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'MANUAL']).optional(),
  tagIds: z.string().optional(),
  adminId: z.string().optional(),
  search: z.string().optional(),
  isBot: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = querySchema.parse(req.query);

    const filters = {
      status: query.status as 'OPEN' | 'PENDING' | 'RESOLVED' | 'SNOOZED' | undefined,
      platform: query.platform as 'LINE' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'MANUAL' | undefined,
      tagIds: query.tagIds ? query.tagIds.split(',') : undefined,
      adminId: query.adminId,
      search: query.search,
      isBot: query.isBot !== undefined ? query.isBot === 'true' : undefined,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
    };

    const result = await ConversationService.list(filters);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query params', details: error.errors });
      return;
    }
    logger.error('List conversations error', { error });
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversation = await ConversationService.getById(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json(conversation);
  } catch (error) {
    logger.error('Get conversation error', { error });
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

const updateSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'SNOOZED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
});

router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = updateSchema.parse(req.body);
    const conversation = await ConversationService.update(req.params.id, data);
    res.json(conversation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Update conversation error', { error });
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

const botToggleSchema = z.object({
  isBot: z.boolean(),
});

router.patch('/:id/bot', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = botToggleSchema.parse(req.body);
    const conversation = await ConversationService.toggleBot(req.params.id, data.isBot);
    res.json(conversation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Toggle bot error', { error });
    res.status(500).json({ error: 'Failed to toggle bot' });
  }
});

router.post('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ConversationService.markRead(req.params.id);
    getSocketIO().emit('conversation:updated', { id: req.params.id, unreadCount: 0 });
    res.json({ message: 'Marked as read' });
  } catch (error) {
    logger.error('Mark read error', { error });
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

const assignSchema = z.object({
  adminId: z.string().cuid(),
});

router.post('/:id/assign', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = assignSchema.parse(req.body);
    const assignment = await ConversationService.assign(req.params.id, data.adminId);
    res.json(assignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Assign conversation error', { error });
    res.status(500).json({ error: 'Failed to assign' });
  }
});

const tagSchema = z.object({
  tagId: z.string().cuid(),
});

router.post('/:id/tags', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = tagSchema.parse(req.body);
    const tag = await ConversationService.addTag(req.params.id, data.tagId, req.admin?.id);
    res.json(tag);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Add tag error', { error });
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

router.delete('/:id/tags/:tagId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ConversationService.removeTag(req.params.id, req.params.tagId);
    res.json({ message: 'Tag removed' });
  } catch (error) {
    logger.error('Remove tag error', { error });
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

const noteSchema = z.object({
  content: z.string().min(1),
});

router.post('/:id/notes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = noteSchema.parse(req.body);
    const note = await ConversationService.addNote(req.params.id, data.content, req.admin!.id);
    res.json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Add note error', { error });
    res.status(500).json({ error: 'Failed to add note' });
  }
});

router.get('/:id/notes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notes = await prisma.conversationNote.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  } catch (error) {
    logger.error('Get notes error', { error });
    res.status(500).json({ error: 'Failed to get notes' });
  }
});

const updateNoteSchema = z.object({
  content: z.string().min(1),
});

router.patch('/:id/notes/:noteId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = updateNoteSchema.parse(req.body);
    const note = await prisma.conversationNote.update({
      where: { id: req.params.noteId },
      data: { content: data.content },
    });
    res.json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Update note error', { error });
    res.status(500).json({ error: 'Failed to update note' });
  }
});

router.delete('/:id/notes/:noteId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.conversationNote.delete({
      where: { id: req.params.noteId },
    });
    res.json({ message: 'Note deleted' });
  } catch (error) {
    logger.error('Delete note error', { error });
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
