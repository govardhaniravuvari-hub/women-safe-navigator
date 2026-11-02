import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { q, q1, insert } from '../db/pool.js';
import { asyncHandler, validate, ApiError, notFound } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';
import { isValidCoord } from '../lib/geo.js';
import { config } from '../config.js';

export const sharingRouter = Router();
sharingRouter.use(requireUser);

const mapShare = (s) => ({
  id: s.id,
  token: s.token,
  label: s.label,
  shareUrl: `${config.appUrl}/share/${s.token}`,
  sharePath: `/share/${s.token}`,
  lat: s.latitude != null ? Number(s.latitude) : null,
  lng: s.longitude != null ? Number(s.longitude) : null,
  accuracy: s.accuracy != null ? Number(s.accuracy) : null,
  isActive: Boolean(s.is_active),
  expiresAt: s.expires_at,
  lastUpdateAt: s.last_update_at,
  createdAt: s.created_at,
  stoppedAt: s.stopped_at,
});

sharingRouter.get(
  '/active',
  asyncHandler(async (req, res) => {
    const row = await q1(
      `SELECT * FROM shared_locations
        WHERE user_id = ? AND is_active = 1 AND expires_at > NOW()
        ORDER BY id DESC LIMIT 1`,
      [req.user.id],
    );
    res.json({ share: row ? mapShare(row) : null });
  }),
);

sharingRouter.post(
  '/start',
  validate(
    z.object({
      durationMinutes: z.number().int().min(5, 'Share for at least 5 minutes.').max(1440, 'Maximum sharing window is 24 hours.'),
      label: z.string().trim().max(120).optional(),
      lat: z.number().min(-90).max(90).nullable().optional(),
      lng: z.number().min(-180).max(180).nullable().optional(),
      accuracy: z.number().min(0).max(100000).nullable().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { durationMinutes, label, lat, lng, accuracy } = req.body;
    // Only one active share at a time: revoke older ones.
    await q(
      `UPDATE shared_locations SET is_active = 0, stopped_at = NOW()
        WHERE user_id = ? AND is_active = 1`,
      [req.user.id],
    );

    const token = crypto.randomBytes(24).toString('hex');
    const hasLocation = lay(lat) && lay(lng) && isValidCoord(lat, lng);
    const id = await insert(
      `INSERT INTO shared_locations
        (user_id, token, label, latitude, longitude, accuracy, expires_at, last_update_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)`,
      [
        req.user.id,
        token,
        label || null,
        hasLocation ? lat : null,
        hasLocation ? lng : null,
        hasLocation ? accuracy ?? null : null,
        durationMinutes,
        hasLocation ? new Date() : null,
      ],
    );
    if (hasLocation) {
      await insert(
        'INSERT INTO location_history (user_id, latitude, longitude, accuracy, source) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, lat, lng, accuracy ?? null, 'share'],
      );
    }
    const row = await q1('SELECT * FROM shared_locations WHERE id = ?', [id]);
    res.status(201).json({
      message: `Live location sharing is on for ${durationMinutes} minutes. Anyone with the link can see your latest position until you stop sharing.`,
      share: mapShare(row),
    });
  }),
);

function lay(v) {
  return v !== undefined && v !== null && Number.isFinite(Number(v));
}

sharingRouter.post(
  '/location',
  validate(
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accuracy: z.number().min(0).max(100000).nullable().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { lat, lng, accuracy } = req.body;
    if (!isValidCoord(lat, lng)) throw new ApiError(400, 'Invalid coordinates.');
    const share = await q1(
      `SELECT * FROM shared_locations
        WHERE user_id = ? AND is_active = 1 AND expires_at > NOW()
        ORDER BY id DESC LIMIT 1`,
      [req.user.id],
    );
    if (!share) throw notFound('No active sharing session. Start sharing first.');

    await q(
      'UPDATE shared_locations SET latitude = ?, longitude = ?, accuracy = ?, last_update_at = NOW() WHERE id = ?',
      [lat, lng, accuracy ?? null, share.id],
    );
    await insert(
      'INSERT INTO location_history (user_id, latitude, longitude, accuracy, source) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, lat, lng, accuracy ?? null, 'share'],
    );
    const updated = await q1('SELECT * FROM shared_locations WHERE id = ?', [share.id]);
    res.json({ message: 'Location updated.', share: mapShare(updated) });
  }),
);

sharingRouter.post(
  '/stop',
  asyncHandler(async (req, res) => {
    await q(
      `UPDATE shared_locations SET is_active = 0, stopped_at = NOW()
        WHERE user_id = ? AND is_active = 1`,
      [req.user.id],
    );
    res.json({ message: 'Live location sharing stopped. The link no longer shows your location.' });
  }),
);

sharingRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const rows = await q(
      'SELECT * FROM shared_locations WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id],
    );
    res.json({ shares: rows.map(mapShare) });
  }),
);
