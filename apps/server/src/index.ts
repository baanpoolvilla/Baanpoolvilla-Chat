import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { logger } from './lib/logger';
import { initSocketIO } from './socket';
import routes from './routes';
import { apiLimiter } from './middleware/rateLimit';
import { startBroadcastWorker } from './jobs/broadcastWorker';

interface RequestWithRawBody extends express.Request {
  rawBody?: string;
}

// ─── Validate required env vars ──────────────────────────
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const server = http.createServer(app);

// ─── Middleware ──────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow non-browser requests (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    (req as RequestWithRawBody).rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: true }));

// ─── Rate limiting ──────────────────────────────────────
app.use('/api', apiLimiter);

// ─── Health check ───────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ─────────────────────────────────────────
app.use('/api', routes);

// ─── Socket.io ──────────────────────────────────────────
initSocketIO(server);

// ─── BullMQ Worker ──────────────────────────────────────
startBroadcastWorker();

// ─── Error handler ──────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start server ───────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server listening on port ${PORT}`, {
    env: process.env.NODE_ENV || 'development',
  });
});

// ─── Graceful shutdown ──────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down');
  server.close(() => process.exit(0));
});

export default app;
