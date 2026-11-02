import { Router } from 'express';
import { z } from 'zod';
import { q, q1, insert } from '../db/pool.js';
import { asyncHandler, validate, notFound } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';
import { isValidCoord, samplePolyline, haversineMeters } from '../lib/geo.js';
import { fetchRoutes, geocode, reverseGeocode } from '../services/routing.js';
import { activityAndLighting, pointActivity } from '../services/overpass.js';
import { scoreRoute, SCORING_MODEL, filterReportsNearRoute } from '../services/safety.js';

export const navigationRouter = Router();

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().trim().max(255).optional(),
});

/** Place search (destination autocomplete) via OpenStreetMap Nominatim. */
navigationRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (query.length < 3) return res.json({ results: [] });
    const results = await geocode(query);
    res.json({ results, provider: 'OpenStreetMap Nominatim' });
  }),
);

navigationRouter.get(
  '/reverse',
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!isValidCoord(lat, lng)) return res.status(400).json({ error: 'Invalid coordinates.' });
    const address = await reverseGeocode(lat, lng);
    res.json({ address });
  }),
);

/** Verified unsafe-location markers for the map. */
navigationRouter.get(
  '/unsafe-points',
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Math.min(Number(req.query.radius || 5000), 25000);
    if (!isValidCoord(lat, lng)) return res.status(400).json({ error: 'Invalid coordinates.' });

    const dLat = radius / 111320;
    const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
    const rows = await q(
      `SELECT id, category, description, latitude, longitude, severity, occurred_at, verified_at, is_sample
         FROM safety_reports
        WHERE status = 'verified'
          AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
        ORDER BY verified_at DESC LIMIT 200`,
      [lat - dLat, lat + dLat, lng - dLng, lng + dLng],
    );
    const points = rows
      .map((r) => ({
        id: r.id,
        category: r.category,
        description: r.description?.slice(0, 200),
        severity: r.severity,
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        occurredAt: r.occurred_at,
        verifiedAt: r.verified_at,
        isSample: Boolean(r.is_sample),
        distanceMeters: Math.round(
          haversineMeters({ lat, lng }, { lat: Number(r.latitude), lng: Number(r.longitude) }),
        ),
      }))
      .filter((r) => r.distanceMeters <= radius);
    res.json({ points });
  }),
);

/**
 * Core safe-route endpoint. Compares up to 3 walking routes and scores each one
 * with the documented, transparent estimate model.
 */
navigationRouter.post(
  '/routes',
  validate(
    z.object({
      from: pointSchema,
      to: pointSchema,
    }),
  ),
  asyncHandler(async (req, res) => {
    const { from, to } = req.body;
    if (!isValidCoord(from.lat, from.lng) || !isValidCoord(to.lat, to.lng)) {
      return res.status(400).json({ error: 'Invalid coordinates provided.' });
    }

    const { routes: fetchedRoutes, source: routingSource } = await fetchRoutes(from, to);
    const routes = fetchedRoutes.slice(0, 3);

    // Verified reports around the whole corridor
    const allSamples = routes.flatMap((r, idx) =>
      samplePolyline(r.coordinates, 5).map((s) => ({ ...s, routeIndex: idx })),
    );
    const lats = allSamples.map((s) => s.lat);
    const lngs = allSamples.map((s) => s.lng);
    const pad = 0.03;
    const reports = await q(
      `SELECT id, category, severity, latitude, longitude, occurred_at, verified_at
         FROM safety_reports
        WHERE status = 'verified'
          AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
        LIMIT 400`,
      [Math.min(...lats) - pad, Math.max(...lats) + pad, Math.min(...lngs) - pad, Math.max(...lngs) + pad],
    );

    // One Overpass request covering all routes' sample points
    const osmData = await activityAndLighting(allSamples);

    const scored = routes.map((route, idx) => {
      const relevantReports = filterReportsNearRoute(reports, route.coordinates);
      let activity = null;
      if (osmData) {
        const mine = allSamples
          .filter((s) => s.routeIndex === idx)
          .map((s) => ({ lat: s.lat, lng: s.lng }));
        let lamps = 0;
        let act = 0;
        let openLate = 0;
        for (const el of osmData.elements) {
          const near = mine.some((s) => haversineMeters(s, el) <= 40);
          if (!near) continue;
          if (el.kind === 'lamp') lamps += 1;
          else {
            act += 1;
            if (el.openLate) openLate += 1;
          }
        }
        activity = { lamps, activity: act, openLate, samples: mine.length || 1 };
      }

      const safety = scoreRoute(route, relevantReports, activity);
      return {
        id: route.id,
        source: route.source,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        coordinates: route.coordinates,
        safety,
      };
    });

    const best = scored.reduce((a, b) => (b.safety.score > a.safety.score ? b : a), scored[0]);

    res.json({
      from,
      to,
      routes: scored,
      recommendedRouteId: best.id,
      routingSource,
      dataNotes: {
        routing:
          routingSource === 'valhalla' || routingSource === 'osrm'
            ? `Distances, times and alternative paths come from the public ${routingSource === 'valhalla' ? 'Valhalla' : 'OSRM'} pedestrian router (OpenStreetMap data).`
            : 'Live routing was unavailable, so distance and time are straight-line estimates with a 1.35x detour factor.',
        lighting: osmData
          ? 'Street-lamp counts come from OpenStreetMap within 40 m of sampled points.'
          : 'OpenStreetMap Overpass data was unavailable, so lighting and activity were excluded from scoring.',
        reports: `${reports.length} verified community report(s) were considered in this area.`,
      },
      model: SCORING_MODEL,
    });
  }),
);

/** App users only below. */
navigationRouter.use(requireUser);

navigationRouter.post(
  '/saved',
  validate(
    z.object({
      label: z.string().trim().min(1, 'Give this route a name.').max(140),
      from: pointSchema,
      to: pointSchema,
      distanceMeters: z.number().min(0),
      durationSeconds: z.number().min(0),
      safetyScore: z.number().min(0).max(100).nullable().optional(),
      safetyLabel: z.string().max(40).nullable().optional(),
      geometry: z.array(z.array(z.number())).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const id = await insert(
      `INSERT INTO safe_routes
        (user_id, label, origin_label, dest_label, origin_lat, origin_lng, dest_lat, dest_lng,
         distance_meters, duration_seconds, safety_score, safety_label, geometry)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        b.label,
        b.from.label || null,
        b.to.label || null,
        b.from.lat,
        b.from.lng,
        b.to.lat,
        b.to.lng,
        Math.round(b.distanceMeters),
        Math.round(b.durationSeconds),
        b.safetyScore != null ? Math.round(b.safetyScore) : null,
        b.safetyLabel || null,
        b.geometry ? JSON.stringify(b.geometry) : null,
      ],
    );
    const row = await q1('SELECT * FROM safe_routes WHERE id = ?', [id]);
    res.status(201).json({ message: 'Route saved.', route: row });
  }),
);

navigationRouter.get(
  '/saved',
  asyncHandler(async (req, res) => {
    const rows = await q(
      'SELECT * FROM safe_routes WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id],
    );
    res.json({ routes: rows });
  }),
);

navigationRouter.delete(
  '/saved/:id',
  asyncHandler(async (req, res) => {
    const result = await q('DELETE FROM safe_routes WHERE id = ? AND user_id = ?', [
      Number(req.params.id),
      req.user.id,
    ]);
    if (!result.affectedRows) throw notFound('Saved route not found.');
    res.json({ message: 'Saved route removed.' });
  }),
);

/**
 * Extra context for a single point (used on the report form and map popups).
 * Returns real OSM POI density; never fabricated.
 */
navigationRouter.get(
  '/point-context',
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!isValidCoord(lat, lng)) return res.status(400).json({ error: 'Invalid coordinates.' });
    const activity = await pointActivity(lat, lng, 150);
    res.json({
      activity: activity ? activity.total : null,
      available: Boolean(activity),
      note: activity
        ? `${activity.total} mapped shops/amenities within 150 m (OpenStreetMap).`
        : 'OpenStreetMap context data is unavailable right now.',
    });
  }),
);
