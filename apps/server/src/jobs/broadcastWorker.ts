import { Worker, Job } from 'bullmq';
import { BroadcastStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { redisConnection } from '../lib/redis';
import { logger } from '../lib/logger';
import { LineService } from '../services/platforms/LineService';
import { FacebookService } from '../services/platforms/FacebookService';
import { InstagramService } from '../services/platforms/InstagramService';
import { TikTokService } from '../services/platforms/TikTokService';
import { BroadcastService } from '../services/BroadcastService';

interface BroadcastJobData {
  broadcastId: string;
}

export function startBroadcastWorker(): Worker {
  const worker = new Worker<BroadcastJobData>(
    'broadcast',
    async (job: Job<BroadcastJobData>) => {
      const { broadcastId } = job.data;
      logger.info('Processing broadcast', { broadcastId });

      const broadcast = await prisma.broadcast.findUnique({
        where: { id: broadcastId },
      });

      if (!broadcast) {
        logger.error('Broadcast not found', { broadcastId });
        return;
      }

      if (broadcast.scheduledAt && broadcast.scheduledAt > new Date()) {
        logger.info('Broadcast not yet scheduled', { broadcastId, scheduledAt: broadcast.scheduledAt });
        return;
      }

      const contacts = await BroadcastService.getTargetContacts(broadcast);

      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          status: BroadcastStatus.SENDING,
          totalCount: contacts.length,
          sentAt: new Date(),
        },
      });

      let sentCount = 0;
      let failCount = 0;

      for (const contact of contacts) {
        for (const platformLink of contact.platformLinks) {
          if (!broadcast.platforms.includes(platformLink.platform)) continue;

          try {
            switch (platformLink.platform) {
              case 'LINE':
                await LineService.sendMessage(
                  platformLink.platformUid,
                  broadcast.content,
                  broadcast.contentType,
                  broadcast.mediaUrl || undefined
                );
                break;
              case 'FACEBOOK':
                await FacebookService.sendMessage(
                  platformLink.platformUid,
                  broadcast.content,
                  broadcast.contentType,
                  broadcast.mediaUrl || undefined
                );
                break;
              case 'INSTAGRAM':
                await InstagramService.sendMessage(
                  platformLink.platformUid,
                  broadcast.content,
                  broadcast.contentType,
                  broadcast.mediaUrl || undefined
                );
                break;
              case 'TIKTOK':
                await TikTokService.sendMessage(
                  platformLink.platformUid,
                  broadcast.content,
                  broadcast.contentType,
                  broadcast.mediaUrl || undefined
                );
                break;
            }

            await prisma.broadcastLog.create({
              data: {
                broadcastId,
                contactId: contact.id,
                platform: platformLink.platform,
                status: 'sent',
              },
            });
            sentCount++;
          } catch (error) {
            await prisma.broadcastLog.create({
              data: {
                broadcastId,
                contactId: contact.id,
                platform: platformLink.platform,
                status: 'failed',
                error: (error as Error).message,
              },
            });
            failCount++;
          }

          await prisma.broadcast.update({
            where: { id: broadcastId },
            data: { sentCount, failCount },
          });
        }
      }

      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          status: failCount > 0 && sentCount === 0 ? BroadcastStatus.FAILED : BroadcastStatus.COMPLETED,
          sentCount,
          failCount,
        },
      });

      logger.info('Broadcast completed', { broadcastId, sentCount, failCount });
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job: Job) => {
    logger.debug('Broadcast job completed', { jobId: job.id });
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error('Broadcast job failed', { jobId: job?.id, error: err.message });
  });

  logger.info('Broadcast worker started');
  return worker;
}
