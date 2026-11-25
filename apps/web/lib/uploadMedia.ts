import axios from 'axios';
import api from '@/lib/api';

/**
 * อัปโหลดไฟล์สื่อสำหรับส่งในแชท
 *
 * ปัญหาเดิม (ส่งรูปขนาดใหญ่ไม่ได้):
 *  - รูปจากมือถือ/กล้องมักใหญ่ 5–20 MB แต่ LINE รับรูปต้นฉบับได้ไม่เกิน 10 MB และรูปพรีวิวไม่เกิน 1 MB
 *    (เราส่ง URL เดียวกันให้ทั้งคู่) → ลูกค้าเห็นรูปเสีย/ส่งไม่ออก
 *  - อัปโหลดเป็น base64 ใน JSON ทำให้ไฟล์ใหญ่ขึ้น ~33% และติดเพดาน 25 MB ของเซิร์ฟเวอร์
 *
 * แก้โดย: ย่อรูปในเบราว์เซอร์ให้เป็น JPEG ≤ ~1 MB ก่อน แล้วอัปโหลดแบบ multipart
 */

/** เพดานไฟล์ที่ไม่ใช่รูป (วิดีโอ/เอกสาร) — ต้องตรงกับ MAX_MEDIA_BYTES ฝั่งเซิร์ฟเวอร์ */
export const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;
export const MAX_UPLOAD_MB = Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024);

const TARGET_IMAGE_BYTES = 1024 * 1024; // พอดีกับเพดานรูปพรีวิวของ LINE
const MAX_IMAGE_DIMENSION = 2048;

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation: 'from-image' = หมุนตาม EXIF (รูปจากมือถือจะไม่ตะแคง)
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // ตกไปใช้ <img> ด้านล่าง
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * ย่อรูปให้เหมาะกับการส่งแชท คืนไฟล์เดิมถ้าไม่จำเป็นต้องย่อ หรือย่อไม่ได้ (เช่น HEIC บน Chrome)
 */
export async function compressImageForChat(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  // GIF ย่อแล้วจะเสียแอนิเมชัน / SVG เป็นเวกเตอร์ — ส่งตามเดิม
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  // JPEG/PNG ที่เล็กอยู่แล้วไม่ต้องแตะ (LINE รองรับแค่ JPEG/PNG จึงแปลง webp/heic เสมอ)
  const lineFriendly = file.type === 'image/jpeg' || file.type === 'image/png';
  if (lineFriendly && file.size <= TARGET_IMAGE_BYTES) return file;

  let decoded: Awaited<ReturnType<typeof decodeImage>>;
  try {
    decoded = await decodeImage(file);
  } catch {
    return file;
  }

  try {
    let maxDim = MAX_IMAGE_DIMENSION;
    let best: Blob | null = null;

    // ลองลดคุณภาพก่อน ถ้ายังใหญ่ค่อยลดขนาดภาพ
    for (const dim of [maxDim, 1600, 1280]) {
      maxDim = dim;
      const scale = Math.min(1, maxDim / Math.max(decoded.width, decoded.height));
      const w = Math.max(1, Math.round(decoded.width * scale));
      const h = Math.max(1, Math.round(decoded.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      // พื้นขาว — PNG โปร่งใสแปลงเป็น JPEG จะได้ไม่กลายเป็นพื้นดำ
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(decoded.source, 0, 0, w, h);

      for (const quality of [0.85, 0.75, 0.65]) {
        const blob = await canvasToBlob(canvas, quality);
        if (!blob) continue;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= TARGET_IMAGE_BYTES) break;
      }
      if (best && best.size <= TARGET_IMAGE_BYTES) break;
    }

    if (!best || (lineFriendly && best.size >= file.size)) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([best], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    decoded.close();
  }
}

function readAsBase64(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

export function getUploadErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 413) return `ไฟล์ใหญ่เกินไป (สูงสุด ${MAX_UPLOAD_MB} MB)`;
    const serverMsg = (err.response?.data as { error?: string } | undefined)?.error;
    return serverMsg || err.message;
  }
  return err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ';
}

/**
 * ย่อรูป (ถ้าเป็นรูป) แล้วอัปโหลด คืน URL สาธารณะของไฟล์
 */
export async function uploadMedia(original: File): Promise<string> {
  const file = await compressImageForChat(original);

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`ไฟล์ใหญ่เกินไป (สูงสุด ${MAX_UPLOAD_MB} MB)`);
  }

  const form = new FormData();
  form.append('file', file, file.name);

  try {
    const res = await api.post('/api/media/upload-file', form, { timeout: 10 * 60 * 1000 });
    const url = res.data?.data?.url as string | undefined;
    if (!url) throw new Error('No URL returned from upload');
    return url;
  } catch (err) {
    // เซิร์ฟเวอร์รุ่นเก่ายังไม่มี /upload-file → ใช้ endpoint base64 เดิม (เพดาน 25 MB)
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      const base64 = await readAsBase64(file);
      const res = await api.post('/api/media/upload', { data: base64, mimeType: file.type });
      const url = res.data?.data?.url as string | undefined;
      if (!url) throw new Error('No URL returned from upload');
      return url;
    }
    throw err;
  }
}
