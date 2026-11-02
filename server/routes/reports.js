import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { q, q1, insert } from '../db/pool.js';
import { asyncHandler, ApiError, notFound } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';
import { config } from '../config.js';
import { isValidCoord } from '../lib/geo.js';

export const reportsRouter = Router();

export const CATEGORY_LABELS = {
  unsafe_route: 'Unsafe travelling route',
  poor_lighting: 'Poorly lit road',
  harassment: 'Harassment incident',
  suspicious_activity: 'Suspicious activity',
  unsafe_place: 'Unsafe public place',
  other: 'Other safety concern',
};

const imagesDir = path.join(config.uploadsDir, 'reports');
fs.mkdirSync(imagesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, imagesDir),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().slice(0, 5);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new ApiError(415, 'Only JPG, PNG, WEBP or GIF images are allowed.'), ok);
  },
});

const mapOwnReport = (r) => ({
  id: r.id,
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
});

reportsRouter.use(requireUser);

reportsRouter.post(
  '/',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const parse = z
      .object({
        category: z.enum(Object.keys(CATEGORY_LABELS)),
        description: z.string().trim().min(15, 'Please describe what happened in at least 15 characters.').max(2000),
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
        address: z.string().trim().max(255).optional(),
        occurredAt: z.string().min(1, 'Please provide the date and time.'),
        severity: z.enum(['low', 'medium', 'high']).default('medium'),
        contactOk: z.enum(['true', 'false']).optional(),
      })
      .safeParse(req.body);

    if (!parse.success) {
      const issue = parse.error.issues[0];
      throw new ApiError(422, issue?.message || 'Invalid report data.');
    }
    const data = parse.data;
    if (!isValidCoord(data.lat, data.lng)) throw new ApiError(422, 'Invalid report location.');

    const occurred = new Date(data.occurredAt);
    if (Number.isNaN(occurred.getTime())) throw new ApiError(422, 'Invalid date and time.');
    if (occurred.getTime() > Date.now() + 60 * 60 * 1000) {
      throw new ApiError(422, 'The reported time cannot be in the future.');
    }

    const id = await insert(
      `INSERT INTO safety_reports
        (user_id, category, description, latitude, longitude, address, occurred_at, severity,
         image_path, contact_ok)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        data.category,
        data.description,
        data.lat,
        data.lng,
        data.address || null,
        occurred,
        data.severity,
        req.file ? req.file.filename : null,
        data.contactOk === 'true' ? 1 : 0,
      ],
    );

    await insert(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES (?, 'report_update', 'Report submitted for review', ?, '/reports')`,
      [
        req.user.id,
        'Your report is pending verification by a SAFEPATH moderator. Only verified reports appear on the safety map.',
      ],
    );

    const row = await q1('SELECT * FROM safety_reports WHERE id = ?', [id]);
    res.status(201).json({
      message: 'Report submitted. A moderator will review it before it appears on the map.',
      report: mapOwnReport(row),
    });
  }),
);

reportsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const rows = await q(
      'SELECT * FROM safety_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.user.id],
    );
    res.json({ reports: rows.map(mapOwnReport) });
  }),
);

/** Verified reports near a location, anonymised for the public map. */
reportsRouter.get(
  '/nearby',
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Math.min(Number(req.query.radius || 3000), 25000);
    if (!isValidCoord(lat, lng)) throw new ApiError(400, 'Invalid coordinates.');
    const dLat = radius / 111320;
    const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
    const rows = await q(
      `SELECT id, category, description, latitude, longitude, severity, occurred_at, verified_at, is_sample
         FROM safety_reports
        WHERE status = 'verified'
          AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
        LIMIT 200`,
      [lat - dLat, lat + dLat, lng - dLng, lng + dLng],
    );
    res.json({
      reports: rows.map((r) => ({
        id: r.id,
        category: r.category,
        categoryLabel: CATEGORY_LABELS[r.category] || r.category,
        description: r.description,
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        severity: r.severity,
        occurredAt: r.occurred_at,
        verifiedAt: r.verified_at,
        isSample: Boolean(r.is_sample),
      })),
    });
  }),
);

reportsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = await q1('SELECT * FROM safety_reports WHERE id = ? AND user_id = ?', [
      Number(req.params.id),
      req.user.id,
    ]);
    if (!row) throw notFound('Report not found.');
    if (row.status !== 'pending') {
      throw new ApiError(400, 'Only reports still pending review can be withdrawn.');
    }
    await q('DELETE FROM safety_reports WHERE id = ?', [row.id]);
    res.json({ message: 'Report withdrawn.' });
  }),
);
