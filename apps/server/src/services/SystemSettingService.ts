import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

// ── Chat defaults ──────────────────────────────────────────────────────────
// newConversationBot: แชทใหม่ที่ลูกค้าทักเข้ามาให้บอทตอบอัตโนมัติหรือไม่
//                     false = แอดมินตอบเอง (ค่าเดิมของระบบ)
export interface ChatSettings {
  newConversationBot: boolean;
}

const CHAT_SETTINGS_KEY = 'chat';
const CHAT_DEFAULTS: ChatSettings = { newConversationBot: false };
const CACHE_TTL_MS = 30_000;

let cached: { value: ChatSettings; expiresAt: number } | null = null;

function normalize(value: unknown): ChatSettings {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    newConversationBot:
      typeof v.newConversationBot === 'boolean' ? v.newConversationBot : CHAT_DEFAULTS.newConversationBot,
  };
}

export class SystemSettingService {
  static async getChatSettings(): Promise<ChatSettings> {
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const row = await prisma.systemSetting.findUnique({ where: { key: CHAT_SETTINGS_KEY } });
      const value = normalize(row?.value);
      cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    } catch (error) {
      // ตารางยังไม่ถูก migrate หรือ DB มีปัญหา → ใช้ค่าเริ่มต้น ไม่ให้ข้อความลูกค้าหลุด
      logger.error('Failed to read chat settings, using defaults', { error });
      return CHAT_DEFAULTS;
    }
  }

  static async updateChatSettings(patch: Partial<ChatSettings>): Promise<ChatSettings> {
    const current = await SystemSettingService.getChatSettings();
    const next = normalize({ ...current, ...patch });

    const value: Prisma.InputJsonValue = { ...next };
    await prisma.systemSetting.upsert({
      where: { key: CHAT_SETTINGS_KEY },
      create: { key: CHAT_SETTINGS_KEY, value },
      update: { value },
    });

    cached = { value: next, expiresAt: Date.now() + CACHE_TTL_MS };
    logger.info('Chat settings updated', next);
    return next;
  }

  /** ค่า isBot ที่จะใช้กับแชทที่เพิ่งถูกสร้างใหม่ */
  static async getNewConversationIsBot(): Promise<boolean> {
    const settings = await SystemSettingService.getChatSettings();
    return settings.newConversationBot;
  }

  static clearCache(): void {
    cached = null;
  }
}

export default SystemSettingService;
