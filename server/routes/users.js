import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { q, q1, insert } from '../db/pool.js';
import { asyncHandler, validate, badRequest } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';
import { haversineMeters, isValidCoord } from '../lib/geo.js';

export const usersRouter = Router();
usersRouter.use(requireUser);

usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json({
      user: {
        id: req.user.id,
        fullName: req.user.full_name,
        email: req.user.email,
        phone: req.user.phone,
        city: req.user.city,
        bloodGroup: req.user.blood_group,
        medicalNotes: req.user.medical_notes,
        createdAt: req.user.created_at,
      },
    });
  }),
);

usersRouter.patch(
  '/me',
  validate(
    z.object({
      fullName: z.string().trim().min(2, 'Please enter your full name.').max(120).optional(),
      phone: z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/, 'Enter a valid phone number.').optional().or(z.literal('')),
      city: z.string().trim().max(120).optional().or(z.literal('')),
      bloodGroup: z.string().trim().max(8).optional().or(z.literal('')),
      medicalNotes: z.string().trim().max(400).optional().or(z.literal('')),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { fullName, phone, city, bloodGroup, medicalNotes } = req.body;
    const fields = [];
    const params = [];
    const set = (col, val) => {
      if (val !== undefined) {
        fields.push(`${col} = ?`);
        params.push(val === '' ? null : val);
      }
    };
    set('full_name', fullName);
    set('phone', phone);
    set('city', city);
    set('blood_group', bloodGroup);
    set('medical_notes', medicalNotes);
    if (!fields.length) throw badRequest('Nothing to update.');
    params.push(req.user.id);
    await q(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    const user = await q1('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({
      message: 'Profile updated.',
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        city: user.city,
        bloodGroup: user.blood_group,
        medicalNotes: user.medical_notes,
        createdAt: user.created_at,
      },
    });
  }),
);

usersRouter.post(
  '/me/password',
  validate(
    z.object({
      currentPassword: z.string().min(1, 'Enter your current password.'),
      newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters.')
        .max(72)
        .regex(/[A-Za-z]/, 'Password must include a letter.')
        .regex(/[0-9]/, 'Password must include a number.'),
    }),
  ),
  asyncHandler(async (req, res) => {
    const row = await q1('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const ok = await bcrypt.compare(req.body.currentPassword, row.password_hash);
    if (!ok) throw badRequest('Current password is incorrect.');
    const hash = await bcrypt.hash(req.body.newPassword, 12);
    await q('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ message: 'Password changed successfully.' });
  }),
);

/** Dashboard summary: real counts from the database, nothing fabricated. */
usersRouter.get(
  '/me/summary',
  asyncHandler(async (req, res) => {
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : null;
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : null;

    const [[contacts]] = await Promise.all([
      q('SELECT COUNT(*) AS c, SUM(is_primary) AS p FROM emergency_contacts WHERE user_id = ?', [req.user.id]),
    ]);
    const unread = await q1(
      'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id],
    );
    const reports = await q1(
      'SELECT COUNT(*) AS c FROM safety_reports WHERE user_id = ?',
      [req.user.id],
    );
    const activeShare = await q1(
      'SELECT id, token, expires_at, last_update_at FROM shared_locations WHERE user_id = ? AND is_active = 1 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [req.user.id],
    );
    const recentNotifications = await q(
      `SELECT id, type, title, body, link, is_read, created_at
         FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
      [req.user.id],
    );
    const lastLocation = await q1(
      'SELECT latitude, longitude, accuracy, recorded_at FROM location_history WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1',
      [req.user.id],
    );

    let nearbyVerified = [];
    if (isValidCoord(lat, lng)) {
      const reportsAll = await q(
        `SELECT id, category, description, latitude, longitude, severity, occurred_at, verified_at, is_sample
           FROM safety_reports
          WHERE status = 'verified'
            AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
          ORDER BY verified_at DESC LIMIT 60`,
        [lat - 0.12, lat + 0.12, lng - 0.15, lng + 0.15],
      );
      nearbyVerified = reportsAll
        .map((r) => ({
          id: r.id,
          category: r.category,
          description: r.description?.slice(0, 160),
          severity: r.severity,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          occurredAt: r.occurred_at,
          isSample: Boolean(r.is_sample),
          distanceMeters: Math.round(
            haversineMeters({ lat, lng }, { lat: Number(r.latitude), lng: Number(r.longitude) }),
          ),
        }))
        .filter((r) => r.distanceMeters <= 3000)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, 5);
    }

    const sosHistory = await q(
      'SELECT id, status, latitude, longitude, created_at, contacts_notified FROM sos_alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 3',
      [req.user.id],
    );

    res.json({
      stats: {
        contacts: Number(contacts.c || 0),
        primaryContacts: Number(contacts.p || 0),
        unreadNotifications: Number(unread?.c || 0),
        myReports: Number(reports?.c || 0),
        nearbyVerifiedReports: nearbyVerified.length,
      },
      activeShare: activeShare
        ? {
            id: activeShare.id,
            token: activeShare.token,
            shareUrl: `/share/${activeShare.token}`,
            expiresAt: activeShare.expires_at,
            lastUpdateAt: activeShare.last_update_at,
          }
        : null,
      lastLocation: lastLocation
        ? {
            lat: Number(lastLocation.latitude),
            lng: Number(lastLocation.longitude),
            accuracy: lastLocation.accuracy != null ? Number(lastLocation.accuracy) : null,
            recordedAt: lastLocation.recorded_at,
          }
        : null,
      nearbyVerifiedReports: nearbyVerified,
      recentNotifications,
      sosHistory,
    });
  }),
);

/** Log a GPS fix (used for the "current location" card and LocationHistory). */
usersRouter.post(
  '/me/location',
  validate(
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accuracy: z.number().min(0).max(100000).nullable().optional(),
      source: z.enum(['gps', 'route', 'share', 'sos']).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { lat, lng, accuracy, source } = req.body;
    if (!isValidCoord(lat, lng)) throw badRequest('Invalid coordinates.');
    await insert(
      'INSERT INTO location_history (user_id, latitude, longitude, accuracy, source) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, lat, lng, accuracy ?? null, source || 'gps'],
    );
    // keep history bounded per user (last 500 fixes)
    await q(
      `DELETE FROM location_history WHERE user_id = ? AND id NOT IN (
         SELECT id FROM (SELECT id FROM location_history WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 500) t
       )`,
      [req.user.id, req.user.id],
    );
    res.status(201).json({ ok: true });
  }),
);
