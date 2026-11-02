import { Router } from 'express';
import { z } from 'zod';
import { q, q1, insert } from '../db/pool.js';
import { asyncHandler, validate, ApiError, notFound } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';
import { isValidCoord } from '../lib/geo.js';
import { deliverSos, deliveryChannels, channelSummary } from '../services/notify.js';

export const sosRouter = Router();
sosRouter.use(requireUser);

const mapsLink = (lat, lng) =>
  lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null;

function summarise(log, channels) {
  const sent = log.filter((l) => l.status === 'sent').length;
  const failed = log.filter((l) => l.status === 'failed').length;
  const notConfigured = log.filter((l) => l.status === 'not_configured').length;
  const skipped = log.filter((l) => l.status === 'skipped').length;

  let level = 'sent';
  let message;
  if (sent > 0 && failed === 0) {
    message = `Emergency alert delivered to ${sent} recipient${sent > 1 ? 's' : ''}.`;
  } else if (sent > 0) {
    level = 'partial';
    message = `Alert delivered to ${sent} recipient${sent > 1 ? 's' : ''}, but ${failed} delivery attempt(s) failed.`;
  } else if (notConfigured > 0 || (log.length === 0 && !channels.email && !channels.webhook)) {
    level = 'not_configured';
    message =
      'No alert could be delivered because no notification channel is configured on this deployment. Your emergency contacts and 112 are shown below so you can call them directly.';
  } else if (failed > 0) {
    level = 'failed';
    message = 'The notification service could not deliver your alert. Call your contacts and 112 directly.';
  } else if (skipped > 0) {
    level = 'failed';
    message =
      'Your contacts have no email address and no other channel is configured, so no alert could be delivered. Call them and 112 directly.';
  } else {
    level = 'failed';
    message = 'No alert could be delivered. Call your contacts and 112 directly.';
  }

  return { level, message, sent, failed, notConfigured, skipped };
}

sosRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json({
      ...channelSummary(),
      emergencyNumber: '112',
      sosWebhook: deliveryChannels().webhook,
    });
  }),
);

sosRouter.post(
  '/',
  validate(
    z.object({
      lat: z.number().min(-90).max(90).nullable().optional(),
      lng: z.number().min(-180).max(180).nullable().optional(),
      accuracy: z.number().min(0).max(100000).nullable().optional(),
      message: z.string().trim().max(400).optional(),
      locationNote: z.string().trim().max(255).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { accuracy, message, locationNote } = req.body;
    let { lat, lng } = req.body;
    if (!isValidCoord(lat, lng)) {
      lat = null;
      lng = null;
    }

    const alertId = await insert(
      `INSERT INTO sos_alerts (user_id, latitude, longitude, accuracy, message, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [req.user.id, lat, lng, lat != null ? accuracy ?? null : null, message || null],
    );

    if (lat != null) {
      await insert(
        'INSERT INTO location_history (user_id, latitude, longitude, accuracy, source) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, lat, lng, accuracy ?? null, 'sos'],
      );
    }

    const contacts = await q(
      `SELECT id, name, phone, email, relationship, is_primary
         FROM emergency_contacts WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC`,
      [req.user.id],
    );

    const user = { id: req.user.id, full_name: req.user.full_name, email: req.user.email };
    const { log, delivered } = await deliverSos({
      user,
      contacts,
      alert: { id: alertId, latitude: lat, longitude: lng, accuracy, message: message || locationNote || null },
    });

    const channels = deliveryChannels();
    const summary = summarise(log, channels);

    await q(
      'UPDATE sos_alerts SET delivery_log = ?, contacts_notified = ? WHERE id = ?',
      [JSON.stringify({ channels, entries: log, summary }), delivered, alertId],
    );

    await insert(
      `INSERT INTO notifications (user_id, type, title, body, link, latitude, longitude)
       VALUES (?, 'emergency', 'SOS activated', ?, '/dashboard', ?, ?)`,
      [req.user.id, summary.message, lat, lng],
    );

    res.status(201).json({
      alert: {
        id: alertId,
        status: 'active',
        lat,
        lng,
        accuracy: accuracy ?? null,
        message: message || null,
        mapsLink: mapsLink(lat, lng),
        createdAt: new Date().toISOString(),
      },
      delivery: {
        ...summary,
        channels,
        entries: log,
      },
      contacts: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        relationship: c.relationship,
        isPrimary: Boolean(c.is_primary),
      })),
      emergencyNumber: '112',
    });
  }),
);

sosRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const row = await q1('SELECT * FROM sos_alerts WHERE id = ? AND user_id = ?', [
      Number(req.params.id),
      req.user.id,
    ]);
    if (!row) throw notFound('SOS alert not found.');
    if (row.status !== 'active') throw new ApiError(400, 'This alert is already closed.');
    await q("UPDATE sos_alerts SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?", [row.id]);
    await insert(
      `INSERT INTO notifications (user_id, type, title, body)
       VALUES (?, 'emergency', 'SOS cancelled', 'You cancelled the SOS alert. Tell your contacts you are safe if the alert already reached them.')`,
      [req.user.id],
    );
    res.json({ message: 'SOS alert cancelled. Please let your contacts know you are safe.' });
  }),
);

sosRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const rows = await q(
      `SELECT id, latitude, longitude, accuracy, message, status, contacts_notified, created_at, cancelled_at
         FROM sos_alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
      [req.user.id],
    );
    res.json({
      alerts: rows.map((r) => ({
        id: r.id,
        lat: r.latitude != null ? Number(r.latitude) : null,
        lng: r.longitude != null ? Number(r.longitude) : null,
        message: r.message,
        status: r.status,
        contactsNotified: r.contacts_notified,
        createdAt: r.created_at,
        cancelledAt: r.cancelled_at,
        mapsLink: mapsLink(r.latitude != null ? Number(r.latitude) : null, r.longitude != null ? Number(r.longitude) : null),
      })),
    });
  }),
);
