import { Router } from 'express';
import { q, q1 } from '../db/pool.js';
import { asyncHandler, notFound } from '../lib/http.js';

export const awarenessRouter = Router();

const mapContent = (c) => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  summary: c.summary,
  body: c.body,
  category: c.category,
  icon: c.icon,
  source: c.source,
  sortOrder: c.sort_order,
});

awarenessRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const category = req.query.category ? String(req.query.category) : null;
    const rows = category
      ? await q(
          'SELECT * FROM awareness_content WHERE is_published = 1 AND category = ? ORDER BY sort_order, id',
          [category],
        )
      : await q('SELECT * FROM awareness_content WHERE is_published = 1 ORDER BY sort_order, id');
    res.json({ content: rows.map(mapContent) });
  }),
);

awarenessRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const row = await q1('SELECT * FROM awareness_content WHERE slug = ? AND is_published = 1', [
      req.params.slug,
    ]);
    if (!row) throw notFound('Safety guide not found.');
    res.json({ content: mapContent(row) });
  }),
);
