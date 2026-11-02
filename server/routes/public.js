import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { q, q1 } from '../db/pool.js';
import { asyncHandler, notFound } from '../lib/http.js';
import { channelSummary } from '../services/notify.js';
import { config } from '../config.js';

export const publicRouter = Router();

const shareLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

publicRouter.get('/config', (_req, res) => {
  const delivery = channelSummary();
  res.json({
    appName: 'SAFEPATH',
    tagline: 'Your Safety. Your Journey. Your Confidence.',
    emergencyNumber: '112',
    notificationChannels: delivery.channels,
    notificationMessage: delivery.message,
    exposeResetToken: config.exposeResetToken,
  });
});

/** Aggregate, real platform numbers for the landing page. No fabricated figures. */
publicRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const users = await q1("SELECT COUNT(*) AS c FROM users WHERE status = 'active'");
    const reports = await q1("SELECT COUNT(*) AS c FROM safety_reports WHERE status = 'verified'");
    const pending = await q1("SELECT COUNT(*) AS c FROM safety_reports WHERE status = 'pending'");
    const cities = await q1(
      "SELECT COUNT(DISTINCT city) AS c FROM users WHERE city IS NOT NULL AND city <> ''",
    );
    res.json({
      users: Number(users.c || 0),
      verifiedReports: Number(reports.c || 0),
      pendingReports: Number(pending.c || 0),
      cities: Number(cities.c || 0),
      note: 'Counts are live from the SAFEPATH database.',
    });
  }),
);

/**
 * Public live-location viewer. Only reachable with the unguessable share token,
 * and only while the owner keeps sharing active. Exposes a first name and the
 * latest coordinates — nothing else about the user.
 */
publicRouter.get(
  '/share/:token',
  shareLimiter,
  asyncHandler(async (req, res) => {
    const token = String(req.params.token || '');
    if (!/^[a-f0-9]{32,64}$/i.test(token)) throw notFound('This sharing link is invalid.');

    const row = await q1(
      `SELECT s.*, u.full_name, u.city FROM shared_locations s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = ?`,
      [token],
    );
    if (!row) throw notFound('This sharing link is invalid or has been removed.');

    const expired = new Date(row.expires_at).getTime() < Date.now();
    const active = Boolean(row.is_active) && !expired;

    res.json({
      active,
      expired,
      firstName: row.full_name.split(' ')[0],
      label: row.label,
      lat: row.latitude != null ? Number(row.latitude) : null,
      lng: row.longitude != null ? Number(row.longitude) : null,
      accuracy: row.accuracy != null ? Number(row.accuracy) : null,
      lastUpdateAt: row.last_update_at,
      expiresAt: row.expires_at,
      stoppedAt: row.stopped_at,
      ownerCity: row.city,
      pollAfterSeconds: 20,
      note: active
        ? 'Location refreshes while the SAFEPATH user keeps sharing. Do not share this link further.'
        : 'Live sharing has stopped or expired, so no location is shown.',
    });
  }),
);
