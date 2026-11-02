import { Router } from 'express';
import { z } from 'zod';
import { q, q1, insert, withTransaction } from '../db/pool.js';
import { asyncHandler, validate, notFound, badRequest } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';

export const contactsRouter = Router();
contactsRouter.use(requireUser);

const MAX_CONTACTS = 10;

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter the contact name.').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{6,20}$/, 'Enter a valid phone number.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(190).optional().or(z.literal('')),
  relationship: z.string().trim().max(60).optional().or(z.literal('')),
  isPrimary: z.boolean().optional(),
});

const mapContact = (c) => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  email: c.email,
  relationship: c.relationship,
  isPrimary: Boolean(c.is_primary),
  verified: Boolean(c.verified),
  createdAt: c.created_at,
});

contactsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await q(
      'SELECT * FROM emergency_contacts WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC',
      [req.user.id],
    );
    res.json({ contacts: rows.map(mapContact) });
  }),
);

contactsRouter.post(
  '/',
  validate(contactSchema),
  asyncHandler(async (req, res) => {
    const { name, phone, email, relationship, isPrimary } = req.body;
    const count = await q1('SELECT COUNT(*) AS c FROM emergency_contacts WHERE user_id = ?', [req.user.id]);
    if (Number(count.c) >= MAX_CONTACTS) {
      throw badRequest(`You can save up to ${MAX_CONTACTS} trusted contacts.`);
    }
    const id = await withTransaction(async (conn) => {
      if (isPrimary) {
        await conn.query('UPDATE emergency_contacts SET is_primary = 0 WHERE user_id = ?', [req.user.id]);
      }
      const [result] = await conn.query(
        `INSERT INTO emergency_contacts (user_id, name, phone, email, relationship, is_primary)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, name, phone, email || null, relationship || null, isPrimary ? 1 : 0],
      );
      return result.insertId;
    });
    const row = await q1('SELECT * FROM emergency_contacts WHERE id = ?', [id]);
    res.status(201).json({ message: 'Trusted contact added.', contact: mapContact(row) });
  }),
);

contactsRouter.patch(
  '/:id',
  validate(
    contactSchema.partial().extend({ id: z.string().optional() }),
  ),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await q1(
      'SELECT * FROM emergency_contacts WHERE id = ? AND user_id = ?',
      [id, req.user.id],
    );
    if (!existing) throw notFound('Contact not found.');
    const { name, phone, email, relationship, isPrimary } = req.body;

    await withTransaction(async (conn) => {
      if (isPrimary) {
        await conn.query('UPDATE emergency_contacts SET is_primary = 0 WHERE user_id = ?', [req.user.id]);
      }
      const fields = [];
      const params = [];
      if (name !== undefined) { fields.push('name = ?'); params.push(name); }
      if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
      if (email !== undefined) { fields.push('email = ?'); params.push(email || null); }
      if (relationship !== undefined) { fields.push('relationship = ?'); params.push(relationship || null); }
      if (isPrimary !== undefined) { fields.push('is_primary = ?'); params.push(isPrimary ? 1 : 0); }
      if (fields.length) {
        params.push(id, req.user.id);
        await conn.query(
          `UPDATE emergency_contacts SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
          params,
        );
      }
    });

    const row = await q1('SELECT * FROM emergency_contacts WHERE id = ?', [id]);
    res.json({ message: 'Contact updated.', contact: mapContact(row) });
  }),
);

contactsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const result = await q('DELETE FROM emergency_contacts WHERE id = ? AND user_id = ?', [
      id,
      req.user.id,
    ]);
    if (!result.affectedRows) throw notFound('Contact not found.');
    res.json({ message: 'Contact removed.' });
  }),
);
