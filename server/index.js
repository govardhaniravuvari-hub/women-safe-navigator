import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import rateLimit from 'express-rate-limit';
import { config, ROOT_DIR, smtpConfigured, webhookConfigured } from './config.js';
import { healthCheck } from './db/pool.js';
import { ApiError, errorHandler } from './lib/http.js';
import { sameOriginGuard } from './lib/auth.js';

import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { contactsRouter } from './routes/contacts.js';
import { navigationRouter } from './routes/navigation.js';
import { servicesRouter } from './routes/services.js';
import { sharingRouter } from './routes/sharing.js';
import { sosRouter } from './routes/sos.js';
import { reportsRouter } from './routes/reports.js';
import { notificationsRouter } from './routes/notifications.js';
import { awarenessRouter } from './routes/awareness.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';

const app = express();
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false, // Leaflet tiles + OSM need a relaxed policy
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(
  cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sameOriginGuard);
if (config.nodeEnv !== 'test') app.use(morgan('tiny'));

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again shortly.' },
  }),
);

fs.mkdirSync(config.uploadsDir, { recursive: true });
app.use('/uploads', express.static(config.uploadsDir, { maxAge: '1h' }));

app.get('/api/health', async (_req, res) => {
  let db = false;
  try {
    db = await healthCheck();
  } catch {
    db = false;
  }
  res.status(db ? 200 : 503).json({
    ok: db,
    db,
    uptimeSeconds: Math.round(process.uptime()),
    env: config.nodeEnv,
    notifications: { email: smtpConfigured, webhook: webhookConfigured },
  });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/navigation', navigationRouter);
app.use('/api/services', servicesRouter);
app.use('/api/sharing', sharingRouter);
app.use('/api/sos', sosRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/awareness', awarenessRouter);
app.use('/api/public', publicRouter);
app.use('/api/admin', adminRouter);

app.use('/api', (_req, _res, next) => next(new ApiError(404, 'API endpoint not found.')));

// Serve the built React app in production (single-origin deployment).
const clientDist = path.join(ROOT_DIR, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

const server = app.listen(config.port, '0.0.0.0', async () => {
  console.log(`SAFEPATH API listening on http://0.0.0.0:${config.port} (${config.nodeEnv})`);
  try {
    const ok = await healthCheck();
    console.log(ok ? 'MySQL connection OK' : 'MySQL connection FAILED');
  } catch (err) {
    console.error('MySQL connection FAILED:', err.message);
  }
  console.log(
    `Notifications: email=${smtpConfigured ? 'configured' : 'not configured'}, webhook=${webhookConfigured ? 'configured' : 'not configured'}`,
  );
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n${signal} received, shutting down.`);
    server.close(() => process.exit(0));
  });
}
