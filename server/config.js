import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..');

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  appName: 'SAFEPATH',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'safepath',
    connectionLimit: Number(process.env.DB_POOL || 10),
  },

  jwtSecret: process.env.JWT_SECRET || 'safepath-dev-secret-change-me',
  jwtExpires: process.env.JWT_EXPIRES || '7d',

  cookie: {
    user: 'safepath_token',
    admin: 'safepath_admin_token',
    secure: bool(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
  },

  uploadsDir: process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(ROOT_DIR, 'uploads'),

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@safepath.app',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
    name: process.env.ADMIN_NAME || 'SAFEPATH Administrator',
  },

  // Email delivery for SOS alerts / password resets. Optional.
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'SAFEPATH Alerts <no-reply@safepath.app>',
  },

  // Optional generic webhook (Slack/Discord/Telegram-bot bridge etc.)
  sosWebhookUrl: process.env.SOS_WEBHOOK_URL || '',

  // Public demo conveniences (never enabled in production)
  exposeResetToken: bool(process.env.EXPOSE_RESET_TOKEN, process.env.NODE_ENV !== 'production'),

  overpassUrls: (process.env.OVERPASS_URL || 'https://overpass.osm.ch/api/interpreter,https://overpass-api.de/api/interpreter')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean),
  osrmUrl: process.env.OSRM_URL || 'https://router.project-osrm.org',
  valhallaUrl: process.env.VALHALLA_URL || 'https://valhalla1.openstreetmap.de',
};

export const smtpConfigured = Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
export const webhookConfigured = Boolean(config.sosWebhookUrl);
