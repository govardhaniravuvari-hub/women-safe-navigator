import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { q, q1, insert } from '../db/pool.js';
import { asyncHandler, validate, ApiError, unauthorized, notFound, badRequest } from '../lib/http.js';
import { signAdminToken, setAdminCookie, clearAdminCookie, requireAdmin } from '../lib/auth.js';
import { notifyAllUsers, notifyUsers, notifyNearbyUsers } from './notifications.js';
import { CATEGORY_LABELS } from './reports.js';

export const adminRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many administrator sign-in attempts. Try again later.' },
});

async function audit(adminId, action, entity, entityId, detail) {
  await insert(
    'INSERT INTO admin_audit (admin_id, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?)',
    [adminId, action, entity, entityId ?? null, detail ?? null],
  );
}

adminRouter.post(
  '/login',
  loginLimiter,
  validate(z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address.'), password: z.string().min(1, 'Enter your password.') })),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const admin = await q1('SELECT * FROM admins WHERE email = ?', [email]);
    const ok = admin ? await bcrypt.compare(password, admin.password_hash) : false;
    if (!admin || !ok) throw unauthorized('Email or password is incorrect.');
    if (!admin.is_active) throw new ApiError(403, 'This administrator account is disabled.');
    await q('UPDATE admins SET last_login_at = NOW() WHERE id = ?', [admin.id]);
    setAdminCookie(res, signAdminToken(admin));
    await audit(admin.id, 'login', 'admin', admin.id, 'Administrator signed in');
    res.json({ admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  }),
);

adminRouter.post('/logout', (req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

adminRouter.get(
  '/me',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ admin: req.admin });
  }),
);

adminRouter.use(requireAdmin);

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const totals = await q1(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM users WHERE status = 'active') AS active_users,
        (SELECT COUNT(*) FROM safety_reports) AS reports,
        (SELECT COUNT(*) FROM safety_reports WHERE status = 'pending') AS pending_reports,
        (SELECT COUNT(*) FROM safety_reports WHERE status = 'verified') AS verified_reports,
        (SELECT COUNT(*) FROM safety_reports WHERE status = 'rejected') AS rejected_reports,
        (SELECT COUNT(*) FROM sos_alerts) AS sos_alerts,
        (SELECT COUNT(*) FROM sos_alerts WHERE status = 'active') AS active_sos,
        (SELECT COUNT(*) FROM shared_locations WHERE is_active = 1 AND expires_at > NOW()) AS active_shares,
        (SELECT COUNT(*) FROM emergency_contacts) AS contacts
    `);
    const byCategory = await q(
      "SELECT category, COUNT(*) AS c FROM safety_reports WHERE status = 'verified' GROUP BY category",
    );
    const recentReports = await q(
      `SELECT r.id, r.category, r.status, r.created_at, u.full_name AS reporter
         FROM safety_reports r JOIN users u ON u.id = r.user_id
        ORDER BY r.created_at DESC LIMIT 8`,
    );
    const signups = await q(
      `SELECT DATE(created_at) AS day, COUNT(*) AS c FROM users
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
        GROUP BY DATE(created_at) ORDER BY day`,
    );
    res.json({
      totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Number(v)])),
      byCategory: byCategory.map((r) => ({
        category: r.category,
        label: CATEGORY_LABELS[r.category] || r.category,
        count: Number(r.c),
      })),
      recentReports,
      signups: signups.map((s) => ({ day: s.day, count: Number(s.c) })),
    });
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || '').trim();
    const like = `%${search}%`;
    const rows = search
      ? await q(
          `SELECT id, full_name, email, phone, city, status, created_at, last_login_at
             FROM users WHERE full_name LIKE ? OR email LIKE ? OR city LIKE ?
            ORDER BY created_at DESC LIMIT 200`,
          [like, like, like],
        )
      : await q(
          `SELECT id, full_name, email, phone, city, status, created_at, last_login_at
             FROM users ORDER BY created_at DESC LIMIT 200`,
        );
    const counts = await q(
      `SELECT u.id, COUNT(r.id) AS reports, COUNT(DISTINCT c.id) AS contacts
         FROM users u
         LEFT JOIN safety_reports r ON r.user_id = u.id
         LEFT JOIN emergency_contacts c ON c.user_id = u.id
        GROUP BY u.id`,
    );
    const map = new Map(counts.map((c) => [c.id, c]));
    res.json({
      users: rows.map((u) => ({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone,
        city: u.city,
        status: u.status,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
        reports: Number(map.get(u.id)?.reports || 0),
        contacts: Number(map.get(u.id)?.contacts || 0),
      })),
    });
  }),
);

adminRouter.patch(
  '/users/:id',
  validate(z.object({ status: z.enum(['active', 'suspended']) })),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const user = await q1('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) throw notFound('User not found.');
    await q('UPDATE users SET status = ? WHERE id = ?', [req.body.status, id]);
    await audit(req.admin.id, 'user_status', 'user', id, `status -> ${req.body.status}`);
    res.json({ message: `Account ${req.body.status === 'active' ? 'reactivated' : 'suspended'}.` });
  }),
);

adminRouter.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || 'all');
    const rows =
      status === 'all'
        ? await q(
            `SELECT r.*, u.full_name AS reporter, u.email AS reporter_email
               FROM safety_reports r JOIN users u ON u.id = r.user_id
              ORDER BY FIELD(r.status,'pending','verified','rejected'), r.created_at DESC LIMIT 300`,
          )
        : await q(
            `SELECT r.*, u.full_name AS reporter, u.email AS reporter_email
               FROM safety_reports r JOIN users u ON u.id = r.user_id
              WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 300`,
            [status],
          );
    res.json({
      reports: rows.map((r) => ({
        id: r.id,
        reporter: r.reporter,
        reporterEmail: r.reporter_email,
        category: r.category,
        categoryLabel: CATEGORY_LABELS[r.category] || r.category,
        description: r.description,
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        address: r.address,
        occurredAt: r.occurred_at,
        severity: r.severity,
        status: r.status,
        adminNote: r.admin_note,
        imageUrl: r.image_path ? `/uploads/reports/${r.image_path}` : null,
        isSample: Boolean(r.is_sample),
        createdAt: r.created_at,
        verifiedAt: r.verified_at,
      })),
    });
  }),
);

adminRouter.patch(
  '/reports/:id',
  validate(
    z.object({
      status: z.enum(['pending', 'verified', 'rejected']),
      adminNote: z.string().trim().max(400).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const report = await q1('SELECT * FROM safety_reports WHERE id = ?', [id]);
    if (!report) throw notFound('Report not found.');
    const { status, adminNote } = req.body;

    await q(
      `UPDATE safety_reports
          SET status = ?, admin_note = ?, verified_by = ?, verified_at = ?
        WHERE id = ?`,
      [
        status,
        adminNote || null,
        status === 'verified' ? req.admin.id : null,
        status === 'verified' ? new Date() : null,
        id,
      ],
    );

    await notifyUsers([report.user_id], {
      type: 'report_update',
      title:
        status === 'verified'
          ? 'Your safety report was verified'
          : status === 'rejected'
            ? 'Your safety report was not published'
            : 'Your safety report is back in review',
      body:
        (adminNote ? `Moderator note: ${adminNote}` : `Category: ${CATEGORY_LABELS[report.category]}`) +
        (status === 'verified' ? ' It is now visible on the safety map as a verified alert.' : ''),
      link: '/reports',
    });

    let nearbyNotified = 0;
    if (status === 'verified') {
      const result = await notifyNearbyUsers(
        Number(report.latitude),
        Number(report.longitude),
        3000,
        {
          type: 'safety_alert',
          title: `New verified alert: ${CATEGORY_LABELS[report.category]}`,
          body: report.description.slice(0, 180),
          link: '/navigate',
        },
      );
      nearbyNotified = result.count;
    }

    await audit(
      req.admin.id,
      'report_status',
      'safety_report',
      id,
      `${report.status} -> ${status}${adminNote ? ` (${adminNote})` : ''}`,
    );
    res.json({
      message:
        status === 'verified'
          ? `Report verified. ${nearbyNotified} user(s) with a recent location within 3 km were notified.`
          : `Report marked ${status}.`,
      nearbyNotified,
    });
  }),
);

/* ---------------- Emergency service directory ---------------- */

const policeSchema = z.object({
  name: z.string().trim().min(2).max(190),
  address: z.string().trim().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

adminRouter.get(
  '/police',
  asyncHandler(async (_req, res) => {
    const rows = await q('SELECT * FROM police_stations ORDER BY city, name LIMIT 300');
    res.json({ places: rows });
  }),
);

adminRouter.post(
  '/police',
  validate(policeSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const id = await insert(
      `INSERT INTO police_stations (name, address, phone, latitude, longitude, city, source, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 'admin', ?)`,
      [b.name, b.address || null, b.phone || null, b.lat, b.lng, b.city || null, b.isActive === false ? 0 : 1],
    );
    await audit(req.admin.id, 'create', 'police_station', id, b.name);
    res.status(201).json({ message: 'Police station added.', id });
  }),
);

adminRouter.patch(
  '/police/:id',
  validate(policeSchema.partial()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;
    const fields = [];
    const params = [];
    const map = { name: 'name', address: 'address', phone: 'phone', city: 'city' };
    for (const [key, col] of Object.entries(map)) {
      if (b[key] !== undefined) { fields.push(`${col} = ?`); params.push(b[key] || null); }
    }
    if (b.lat !== undefined) { fields.push('latitude = ?'); params.push(b.lat); }
    if (b.lng !== undefined) { fields.push('longitude = ?'); params.push(b.lng); }
    if (b.isActive !== undefined) { fields.push('is_active = ?'); params.push(b.isActive ? 1 : 0); }
    if (!fields.length) throw badRequest('Nothing to update.');
    params.push(id);
    await q(`UPDATE police_stations SET ${fields.join(', ')} WHERE id = ?`, params);
    await audit(req.admin.id, 'update', 'police_station', id);
    res.json({ message: 'Police station updated.' });
  }),
);

adminRouter.delete(
  '/police/:id',
  asyncHandler(async (req, res) => {
    await q('DELETE FROM police_stations WHERE id = ?', [Number(req.params.id)]);
    await audit(req.admin.id, 'delete', 'police_station', Number(req.params.id));
    res.json({ message: 'Police station removed.' });
  }),
);

const hospitalSchema = z.object({
  name: z.string().trim().min(2).max(190),
  address: z.string().trim().max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  emergencyPhone: z.string().trim().max(30).optional().or(z.literal('')),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  type: z.enum(['hospital', 'clinic', 'ambulance', 'other']).optional(),
  isActive: z.boolean().optional(),
});

adminRouter.get(
  '/hospitals',
  asyncHandler(async (_req, res) => {
    const rows = await q('SELECT * FROM hospitals ORDER BY city, name LIMIT 300');
    res.json({ places: rows });
  }),
);

adminRouter.post(
  '/hospitals',
  validate(hospitalSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const id = await insert(
      `INSERT INTO hospitals (name, address, phone, emergency_phone, latitude, longitude, city, type, source, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?)`,
      [
        b.name, b.address || null, b.phone || null, b.emergencyPhone || null,
        b.lat, b.lng, b.city || null, b.type || 'hospital', b.isActive === false ? 0 : 1,
      ],
    );
    await audit(req.admin.id, 'create', 'hospital', id, b.name);
    res.status(201).json({ message: 'Hospital added.', id });
  }),
);

adminRouter.patch(
  '/hospitals/:id',
  validate(hospitalSchema.partial()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;
    const fields = [];
    const params = [];
    const map = { name: 'name', address: 'address', phone: 'phone', emergencyPhone: 'emergency_phone', city: 'city', type: 'type' };
    for (const [key, col] of Object.entries(map)) {
      if (b[key] !== undefined) { fields.push(`${col} = ?`); params.push(b[key] || null); }
    }
    if (b.lat !== undefined) { fields.push('latitude = ?'); params.push(b.lat); }
    if (b.lng !== undefined) { fields.push('longitude = ?'); params.push(b.lng); }
    if (b.isActive !== undefined) { fields.push('is_active = ?'); params.push(b.isActive ? 1 : 0); }
    if (!fields.length) throw badRequest('Nothing to update.');
    params.push(id);
    await q(`UPDATE hospitals SET ${fields.join(', ')} WHERE id = ?`, params);
    await audit(req.admin.id, 'update', 'hospital', id);
    res.json({ message: 'Hospital updated.' });
  }),
);

adminRouter.delete(
  '/hospitals/:id',
  asyncHandler(async (req, res) => {
    await q('DELETE FROM hospitals WHERE id = ?', [Number(req.params.id)]);
    await audit(req.admin.id, 'delete', 'hospital', Number(req.params.id));
    res.json({ message: 'Hospital removed.' });
  }),
);

/* ---------------- Awareness content ---------------- */

const awarenessSchema = z.object({
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and dashes.'),
  title: z.string().trim().min(3).max(190),
  summary: z.string().trim().max(400).optional().or(z.literal('')),
  body: z.string().trim().min(20, 'Content needs at least 20 characters.'),
  category: z.enum(['travel', 'night', 'digital', 'emergency', 'navigation', 'helplines', 'general']),
  icon: z.string().trim().max(40).optional().or(z.literal('')),
  source: z.string().trim().max(255).optional().or(z.literal('')),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isPublished: z.boolean().optional(),
});

adminRouter.get(
  '/awareness',
  asyncHandler(async (_req, res) => {
    const rows = await q('SELECT * FROM awareness_content ORDER BY category, sort_order, id');
    res.json({ content: rows });
  }),
);

adminRouter.post(
  '/awareness',
  validate(awarenessSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const id = await insert(
      `INSERT INTO awareness_content (slug, title, summary, body, category, icon, source, sort_order, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.slug, b.title, b.summary || null, b.body, b.category, b.icon || null, b.source || null, b.sortOrder ?? 0, b.isPublished === false ? 0 : 1],
    );
    await audit(req.admin.id, 'create', 'awareness', id, b.slug);
    res.status(201).json({ message: 'Safety guide published.', id });
  }),
);

adminRouter.patch(
  '/awareness/:id',
  validate(awarenessSchema.partial()),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body;
    const fields = [];
    const params = [];
    const map = {
      slug: 'slug', title: 'title', summary: 'summary', body: 'body',
      category: 'category', icon: 'icon', source: 'source',
    };
    for (const [key, col] of Object.entries(map)) {
      if (b[key] !== undefined) { fields.push(`${col} = ?`); params.push(b[key] || null); }
    }
    if (b.sortOrder !== undefined) { fields.push('sort_order = ?'); params.push(b.sortOrder); }
    if (b.isPublished !== undefined) { fields.push('is_published = ?'); params.push(b.isPublished ? 1 : 0); }
    if (!fields.length) throw badRequest('Nothing to update.');
    params.push(id);
    await q(`UPDATE awareness_content SET ${fields.join(', ')} WHERE id = ?`, params);
    await audit(req.admin.id, 'update', 'awareness', id);
    res.json({ message: 'Safety guide updated.' });
  }),
);

adminRouter.delete(
  '/awareness/:id',
  asyncHandler(async (req, res) => {
    await q('DELETE FROM awareness_content WHERE id = ?', [Number(req.params.id)]);
    await audit(req.admin.id, 'delete', 'awareness', Number(req.params.id));
    res.json({ message: 'Safety guide deleted.' });
  }),
);

/* ---------------- Announcements & activity ---------------- */

adminRouter.post(
  '/announcements',
  validate(
    z.object({
      title: z.string().trim().min(3, 'Give the announcement a title.').max(190),
      body: z.string().trim().min(10, 'Write at least 10 characters.').max(2000),
      link: z.string().trim().max(255).optional().or(z.literal('')),
    }),
  ),
  asyncHandler(async (req, res) => {
    const count = await notifyAllUsers({
      type: 'announcement',
      title: req.body.title,
      body: req.body.body,
      link: req.body.link || '/notifications',
    });
    await audit(req.admin.id, 'announcement', 'notification', null, req.body.title);
    res.status(201).json({ message: `Announcement sent to ${count} active user(s).`, recipients: count });
  }),
);

adminRouter.get(
  '/sos',
  asyncHandler(async (_req, res) => {
    const rows = await q(
      `SELECT s.*, u.full_name, u.email, u.phone FROM sos_alerts s
         JOIN users u ON u.id = s.user_id
        ORDER BY s.created_at DESC LIMIT 50`,
    );
    res.json({
      alerts: rows.map((r) => ({
        id: r.id,
        userName: r.full_name,
        userEmail: r.email,
        userPhone: r.phone,
        lat: r.latitude != null ? Number(r.latitude) : null,
        lng: r.longitude != null ? Number(r.longitude) : null,
        status: r.status,
        contactsNotified: r.contacts_notified,
        createdAt: r.created_at,
      })),
    });
  }),
);

adminRouter.get(
  '/activity',
  asyncHandler(async (_req, res) => {
    const auditRows = await q(
      `SELECT a.*, ad.name AS admin_name FROM admin_audit a
         LEFT JOIN admins ad ON ad.id = a.admin_id
        ORDER BY a.created_at DESC LIMIT 50`,
    );
    const logins = await q(
      `SELECT id, full_name, email, last_login_at FROM users
        WHERE last_login_at IS NOT NULL ORDER BY last_login_at DESC LIMIT 15`,
    );
    const shares = await q(
      `SELECT COUNT(*) AS total,
              SUM(is_active = 1 AND expires_at > NOW()) AS active
         FROM shared_locations`,
    );
    res.json({
      audit: auditRows.map((a) => ({
        id: a.id,
        adminName: a.admin_name || 'system',
        action: a.action,
        entity: a.entity,
        entityId: a.entity_id,
        detail: a.detail,
        createdAt: a.created_at,
      })),
      recentLogins: logins,
      sharing: { total: Number(shares[0]?.total || 0), active: Number(shares[0]?.active || 0) },
    });
  }),
);
