import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request } from 'express';
import { logger } from './logger';

/**
 * เก็บไฟล์สื่อไว้บนเซิร์ฟเวอร์เราเอง (/app/uploads → docker volume uploads_data)
 *
 * เหตุผล: URL รูปจาก Facebook / Instagram (lookaside.fbsbx.com, scontent.xx.fbcdn.net)
 * เป็นลิงก์ CDN แบบมีลายเซ็นที่ "หมดอายุ" ภายในไม่กี่วัน — เดิมเราเก็บลิงก์นั้นลง DB ตรง ๆ
 * ผ่านไป 3-4 วันรูปในแชทรวมจึงเปิดไม่ได้ ต้องโหลดไฟล์มาเก็บเองตอนรับข้อความ
 */

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** Cloudflare (free plan) จำกัด request body ไว้ที่ 100 MB */
export const MAX_MEDIA_BYTES = 95 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/heic': 'heic', 'image/heif': 'heif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/3gpp': '3gp',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

export function extFromMime(mimeType: string | undefined | null): string {
  const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
  return MIME_TO_EXT[mime]
    || mime.split('/')[1]?.split('+')[0]?.replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '')
    || 'bin';
}

export function randomFilename(ext: string, prefix = ''): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
}

export function resolvePublicBase(req: Request): string {
  const configured =
    process.env.PUBLIC_BASE_URL ||
    process.env.API_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_API_URL;

  if (configured) {
    return configured.replace(/\/api\/?$/, '').replace(/\/$/, '');
  }

  const forwardedProto = req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.header('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host');

  return `${protocol}://${host}`.replace(/\/$/, '');
}

export function publicUploadUrl(base: string, filename: string): string {
  return `${base.replace(/\/$/, '')}/uploads/${filename}`;
}

/** URL ชี้มาที่ /uploads ของเราอยู่แล้วหรือไม่ (ไม่ต้องโหลดซ้ำ) */
export function isLocalUploadUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\/uploads\/[^/]+$/.test(url));
}

/**
 * ดาวน์โหลดไฟล์จาก URL ภายนอกมาเก็บใน uploads
 * @param key ค่าคงที่ของข้อความ (เช่น platformMsgId) — ใช้ตั้งชื่อไฟล์ ทำให้ webhook ที่ส่งซ้ำไม่สร้างไฟล์ซ้ำ
 * @returns ชื่อไฟล์ หรือ null ถ้าโหลดไม่สำเร็จ
 */
export async function saveRemoteMedia(
  url: string,
  opts: { prefix: string; key?: string; headers?: Record<string, string> },
): Promise<string | null> {
  try {
    const response = await axios.get<NodeJS.ReadableStream>(url, {
      responseType: 'stream',
      timeout: 30_000,
      maxContentLength: MAX_MEDIA_BYTES,
      headers: opts.headers,
    });

    const ext = extFromMime(response.headers['content-type'] as string | undefined);
    const stem = opts.key
      ? crypto.createHash('sha1').update(opts.key).digest('hex').slice(0, 24)
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const filename = `${opts.prefix}-${stem}.${ext}`;
    const finalPath = path.join(UPLOAD_DIR, filename);

    if (fs.existsSync(finalPath)) {
      (response.data as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
      return filename;
    }

    // เขียนลงไฟล์ชั่วคราวก่อน แล้วค่อย rename — กันไฟล์ครึ่ง ๆ กลาง ๆ ค้างอยู่ถ้าโหลดพลาด
    const tmpPath = `${finalPath}.part`;
    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(tmpPath);
      const stream = response.data as NodeJS.ReadableStream;
      stream.on('error', reject);
      writer.on('error', reject);
      writer.on('finish', resolve);
      stream.pipe(writer);
    }).catch((err) => {
      fs.rmSync(tmpPath, { force: true });
      throw err;
    });
    fs.renameSync(tmpPath, finalPath);

    return filename;
  } catch (error) {
    logger.warn('Failed to save remote media', {
      prefix: opts.prefix,
      key: opts.key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * ใช้ใน webhook: โหลดสื่อมาเก็บแล้วคืน URL ของเรา; ถ้าโหลดไม่ได้คืน URL เดิม (ยังดูได้ชั่วคราว)
 */
export async function persistIncomingMedia(
  req: Request,
  url: string | undefined,
  opts: { prefix: string; key?: string },
): Promise<string | undefined> {
  if (!url) return url;
  const filename = await saveRemoteMedia(url, opts);
  return filename ? publicUploadUrl(resolvePublicBase(req), filename) : url;
}
