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

type SessionAdmin = { id: string; email: string; name: string; avatar: string | null; role: string };

/** Access + refresh tokens and the profile the web stores — shared by password login and SmartBoss SSO. */
async function issueSession(admin: SessionAdmin) {
  const accessToken = jwt.sign(
    { adminId: admin.id, email: admin.email, role: admin.role },
    process.env.JWT_SECRET!,
    { expiresIn: accessTokenExpiresIn }
  );
  const refreshToken = jwt.sign(
    { adminId: admin.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: refreshTokenExpiresIn }
  );
  await prisma.admin.update({
    where: { id: admin.id },
    data: { isOnline: true, lastSeenAt: new Date() },
  });
  return {
    accessToken,
    refreshToken,
    admin: { id: admin.id, email: admin.email, name: admin.name, avatar: admin.avatar, role: admin.role },
  };
}

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

    res.json(await issueSession(admin));
    logger.info('Admin logged in', { adminId: admin.id, email: admin.email });
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

// ─── SmartBoss single sign-on ───────────────────────────────────────────
// SmartBoss signs a 60-second HS256 token (SSO_SECRET, iss "smartboss",
// aud "chat") for its logged-in user and opens /sso#token=… on the web app,
// which posts it here. The SmartBoss user is matched to an Admin by an
// existing link, else by the same email (linked on the spot). Otherwise the
// person proves an existing chat account once with its email/password
// (/sso/link). No account is ever created here — who may see customer chats
// stays decided by a chat admin, same as before.

interface SmartbossIdentity { sub: string; name: string; email: string }

function verifySmartbossToken(token: string): SmartbossIdentity | null {
  const secret = process.env.SSO_SECRET;
  if (!secret || !token) return null;
  try {
    const p = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'smartboss', audience: 'chat' }) as jwt.JwtPayload;
    if (typeof p.sub !== 'string' || !p.sub) return null;
    return { sub: p.sub, name: String(p.name ?? ''), email: String(p.email ?? '') };
  } catch {
    return null;
  }
}

/** Short-lived proof of "SmartBoss already vouched for this person" between /sso and /sso/link.
 * Signed with SSO_SECRET (not JWT_SECRET) so it can never pass as an access token. */
function signPending(sb: SmartbossIdentity): string {
  return jwt.sign({ name: sb.name, email: sb.email, type: 'sso-pending' }, process.env.SSO_SECRET!, { subject: sb.sub, audience: 'chat-sso-pending', expiresIn: '15m' });
}
function readPending(token: string): SmartbossIdentity | null {
  const secret = process.env.SSO_SECRET;
  if (!secret) return null;
  try {
    const p = jwt.verify(token, secret, { algorithms: ['HS256'], audience: 'chat-sso-pending' }) as jwt.JwtPayload;
    if (p.type !== 'sso-pending' || typeof p.sub !== 'string') return null;
    return { sub: p.sub, name: String(p.name ?? ''), email: String(p.email ?? '') };
  } catch {
    return null;
  }
}

/** Link only if the admin isn't already linked to a different SmartBoss user. */
async function linkAdmin(adminId: string, smartbossUserId: string): Promise<boolean> {
  const r = await prisma.admin.updateMany({
    where: { id: adminId, OR: [{ smartbossUserId: null }, { smartbossUserId }] },
    data: { smartbossUserId },
  });
  return r.count === 1;
}

router.post('/sso', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const sb = verifySmartbossToken(String(req.body?.token ?? ''));
    if (!sb) {
      res.status(401).json({ error: 'ลิงก์จาก SmartBoss หมดอายุหรือไม่ถูกต้อง — กลับไปกดเปิดจาก SmartBoss อีกครั้ง' });
      return;
    }

    let admin = await prisma.admin.findUnique({ where: { smartbossUserId: sb.sub } });
    if (!admin && sb.email) {
      const byEmail = await prisma.admin.findFirst({
        where: { email: { equals: sb.email, mode: 'insensitive' }, smartbossUserId: null },
      });
      if (byEmail && (await linkAdmin(byEmail.id, sb.sub))) {
        admin = byEmail;
        logger.info('SmartBoss SSO linked by email', { adminId: byEmail.id, smartbossUserId: sb.sub });
      }
    }

    if (!admin) {
      res.status(409).json({ needLink: true, pendingToken: signPending(sb), name: sb.name, email: sb.email });
      return;
    }

    logger.info('Admin logged in via SmartBoss', { adminId: admin.id, smartbossUserId: sb.sub });
    res.json(await issueSession(admin));
  } catch (error) {
    logger.error('SSO error', { error });
    res.status(500).json({ error: 'เข้าสู่ระบบไม่สำเร็จ' });
  }
});

const ssoLinkSchema = z.object({
  pendingToken: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/sso/link', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = ssoLinkSchema.parse(req.body);
    const sb = readPending(body.pendingToken);
    if (!sb) {
      res.status(401).json({ error: 'หมดเวลา — กลับไปกดเปิดจาก SmartBoss อีกครั้ง' });
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { email: body.email } });
    if (!admin || !(await bcrypt.compare(body.password, admin.passwordHash))) {
      res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }
    if (!(await linkAdmin(admin.id, sb.sub))) {
      res.status(409).json({ error: 'บัญชีนี้ผูกกับผู้ใช้ SmartBoss คนอื่นไปแล้ว — ติดต่อผู้ดูแลระบบ' });
      return;
    }

    logger.info('SmartBoss SSO linked by password', { adminId: admin.id, smartbossUserId: sb.sub });
    res.json(await issueSession(admin));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
      return;
    }
    logger.error('SSO link error', { error });
    res.status(500).json({ error: 'ผูกบัญชีไม่สำเร็จ' });
  }
});

export default router;
