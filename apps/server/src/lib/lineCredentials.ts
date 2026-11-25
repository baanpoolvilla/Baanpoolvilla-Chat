import { logger } from './logger';
import prisma from './prisma';

/**
 * LINE credentials cache.
 *
 * เดิม webhookVerify/LineService ยิง query PlatformConfig ทุก request และใช้
 * `catch {}` กลืน error ทิ้ง — พอ DB สะดุดแม้แค่ครั้งเดียว (pool ถูกตัดตอน idle,
 * pool เต็มเพราะ broadcast worker, Postgres รีสตาร์ต) channelSecret จะกลายเป็นค่าว่าง
 * แล้ว webhook ตอบ 500 → LINE ทิ้งข้อความลูกค้าถาวร
 *
 * ตัวนี้แคชค่าไว้ในหน่วยความจำ และ **ไม่ยอมทิ้งค่าที่เคยโหลดสำเร็จ** เมื่อ DB พลาด
 * ทำให้ข้อความ LINE ไม่ผูกกับความพร้อมของ DB อีกต่อไป
 */

export interface LineCredentials {
  channelSecret?: string;
  accessToken?: string;
}

const CACHE_TTL_MS = 30_000;

let cached: LineCredentials = {};
let cachedAt = 0;
let inflight: Promise<LineCredentials> | null = null;

function fromEnv(): LineCredentials {
  return {
    channelSecret: process.env.LINE_CHANNEL_SECRET || undefined,
    accessToken: process.env.LINE_ACCESS_TOKEN || undefined,
  };
}

async function loadFromDb(): Promise<LineCredentials> {
  const cfg = await prisma.platformConfig.findUnique({ where: { platform: 'LINE' } });
  const c = (cfg?.config ?? {}) as Record<string, string>;
  return {
    channelSecret: c.channelSecret || undefined,
    accessToken: c.accessToken || undefined,
  };
}

export async function getLineCredentials(): Promise<LineCredentials> {
  const isFresh = Date.now() - cachedAt < CACHE_TTL_MS;
  if (isFresh && (cached.channelSecret || cached.accessToken)) return cached;

  if (!inflight) {
    inflight = loadFromDb()
      .then((loaded) => {
        const env = fromEnv();
        // ค่าที่เคยโหลดได้แล้วจะไม่ถูกล้างด้วยผลลัพธ์ที่ว่าง
        cached = {
          channelSecret: loaded.channelSecret || cached.channelSecret || env.channelSecret,
          accessToken: loaded.accessToken || cached.accessToken || env.accessToken,
        };
        cachedAt = Date.now();
        return cached;
      })
      .catch((error) => {
        // DB ล่มต้องไม่ทำให้ credential หาย ไม่งั้นข้อความลูกค้าถูกปฏิเสธทิ้ง
        logger.error('Failed to load LINE credentials from DB — falling back to cached/env values', {
          error: error instanceof Error ? error.message : String(error),
          hasCachedSecret: Boolean(cached.channelSecret),
        });
        const env = fromEnv();
        return {
          channelSecret: cached.channelSecret || env.channelSecret,
          accessToken: cached.accessToken || env.accessToken,
        };
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

/** เรียกหลังแก้ค่า LINE ในหน้าตั้งค่า เพื่อให้ webhook ใช้ secret ใหม่ทันที */
export function invalidateLineCredentials(): void {
  cachedAt = 0;
  cached = {};
}
