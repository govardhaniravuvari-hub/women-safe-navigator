import { Router } from 'express';
import { q, q1, insert } from '../db/pool.js';
import { asyncHandler, notFound } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';
import { haversineMeters, isValidCoord } from '../lib/geo.js';
import { CATEGORY_LABELS } from './reports.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireUser);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await q(
      `SELECT id, type, title, body, link, latitude, longitude, is_read, created_at
         FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.user.id],
    );
    res.json({
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link,
        lat: n.latitude != null ? Number(n.latitude) : null,
        lng: n.longitude != null ? Number(n.longitude) : null,
        isRead: Boolean(n.is_read),
        createdAt: n.created_at,
      })),
    });
  }),
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const result = await q(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [Number(req.params.id), req.user.id],
    );
    if (!result.affectedRows) throw notFound('Notification not found.');
    res.json({ ok: true });
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await q('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
    res.json({ ok: true, message: 'All notifications marked as read.' });
  }),
);

/**
 * Near-you feed: verified reports and announcements relevant to a location.
 * Runs "on demand", so it never invents live tracking.
 */
notificationsRouter.get(
  '/nearby',
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Math.min(Number(req.query.radius || 2000), 15000);
    if (!isValidCoord(lat, lng)) return res.json({ reports: [], note: 'Location not available.' });

    const dLat = radius / 111320;
    const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
    const rows = await q(
      `SELECT id, category, description, latitude, longitude, severity, verified_at, is_sample
         FROM safety_reports
        WHERE status = 'verified'
          AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
        ORDER BY verified_at DESC LIMIT 50`,
      [lat - dLat, lat + dLat, lng - dLng, lng + dLng],
    );
    res.json({
      reports: rows
        .map((r) => ({
          id: r.id,
          category: r.category,
          categoryLabel: CATEGORY_LABELS[r.category] || r.category,
          description: r.description?.slice(0, 180),
          severity: r.severity,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
          verifiedAt: r.verified_at,
          isSample: Boolean(r.is_sample),
          distanceMeters: Math.round(
            haversineMeters({ lat, lng }, { lat: Number(r.latitude), lng: Number(r.longitude) }),
          ),
        }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, 20),
    });
  }),
);

/** Helper used by other routes to fan out a notification. */
export async function notifyUsers(userIds, payload) {
  if (!userIds.length) return 0;
  const values = userIds.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
  const params = userIds.flatMap((id) => [
    id,
    payload.type || 'safety_alert',
    payload.title,
    payload.body || null,
    payload.link || null,
    payload.lat ?? null,
    payload.lng ?? null,
  ]);
  await q(
    `INSERT INTO notifications (user_id, type, title, body, link, latitude, longitude) VALUES ${values}`,
    params,
  );
  return userIds.length;
}

export async function notifyAllUsers(payload) {
  const users = await q('SELECT id FROM users WHERE status = ?', ['active']);
  return notifyUsers(users.map((u) => u.id), payload);
}

export async function notifyNearbyUsers(lat, lng, radiusMeters, payload) {
  const users = await q('SELECT id FROM users WHERE status = ?', ['active']);
  // Users' last known positions live in location_history.
  const last = await q(
    `SELECT lh.user_id, lh.latitude, lh.longitude FROM location_history lh
       JOIN (SELECT user_id, MAX(id) AS max_id FROM location_history GROUP BY user_id) m
         ON m.max_id = lh.id`,
  );
  const positions = new Map(last.map((l) => [l.user_id, l]));
  const targets = [];
  for (const u of users) {
    const pos = positions.get(u.id);
    if (!pos) continue;
    const d = haversineMeters(
      { lat, lng },
      { lat: Number(pos.latitude), lng: Number(pos.longitude) },
    );
    if (d <= radiusMeters) targets.push(u.id);
  }
  await notifyUsers(targets, { ...payload, lat, lng });
  return { count: targets.length };
}
