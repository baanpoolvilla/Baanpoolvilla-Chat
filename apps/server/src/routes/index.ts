import { Router } from 'express';
import authRoutes from './auth';
import conversationRoutes from './conversations';
import messageRoutes from './messages';
import tagRoutes from './tags';
import contactRoutes from './contacts';
import broadcastRoutes from './broadcast';
import adminRoutes from './admins';
import settingsRoutes from './settings';
import lineWebhook from './webhooks/line';
import facebookWebhook from './webhooks/facebook';
import instagramWebhook from './webhooks/instagram';
import tiktokWebhook from './webhooks/tiktok';

const router = Router();

router.use('/auth', authRoutes);
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);
router.use('/tags', tagRoutes);
router.use('/contacts', contactRoutes);
router.use('/broadcasts', broadcastRoutes);
router.use('/admins', adminRoutes);
router.use('/settings', settingsRoutes);

// Webhooks
router.use('/webhooks/line', lineWebhook);
router.use('/webhooks/facebook', facebookWebhook);
router.use('/webhooks/instagram', instagramWebhook);
router.use('/webhooks/tiktok', tiktokWebhook);

export default router;
