import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { q, q1, insert } from '../db/pool.js';
import { config } from '../config.js';
import {
  asyncHandler, validate, ApiError, unauthorized, badRequest,
} from '../lib/http.js';
import {
  signUserToken, setUserCookie, clearUserCookie, requireUser,
} from '../lib/auth.js';
import { sendPasswordResetEmail } from '../services/notify.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.').max(190);
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password is too long.')
  .regex(/[A-Za-z]/, 'Password must include a letter.')
  .regex(/[0-9]/, 'Password must include a number.');

const publicUser = (u) => ({
  id: u.id,
  fullName: u.full_name,
  email: u.email,
  phone: u.phone,
  city: u.city,
  bloodGroup: u.blood_group,
  medicalNotes: u.medical_notes,
  createdAt: u.created_at,
});

authRouter.post(
  '/register',
  authLimiter,
  validate(
    z.object({
      fullName: z.string().trim().min(2, 'Please enter your full name.').max(120),
      email: emailSchema,
      phone: z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/, 'Enter a valid phone number.').optional().or(z.literal('')),
      city: z.string().trim().max(120).optional().or(z.literal('')),
      password: passwordSchema,
      confirmPassword: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { fullName, email, phone, city, password, confirmPassword } = req.body;
    if (confirmPassword !== undefined && password !== confirmPassword) {
      throw badRequest('Passwords do not match.');
    }
    const existing = await q1('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) throw new ApiError(409, 'An account with this email already exists. Try signing in instead.');

    const hash = await bcrypt.hash(password, 12);
    const userId = await insert(
      `INSERT INTO users (full_name, email, phone, city, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [fullName, email, phone || null, city || null, hash],
    );

    await insert(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES (?, 'system', 'Welcome to SAFEPATH', ?, '/dashboard')`,
      [
        userId,
        'Add your trusted emergency contacts and save your home area so SOS and location sharing work when you need them.',
      ],
    );

    const user = await q1('SELECT * FROM users WHERE id = ?', [userId]);
    setUserCookie(res, signUserToken(user));
    res.status(201).json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  validate(z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password.') })),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await q1('SELECT * FROM users WHERE email = ?', [email]);
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !ok) throw unauthorized('Email or password is incorrect.');
    if (user.status === 'suspended') {
      throw new ApiError(403, 'This account has been suspended. Please contact support.');
    }
    await q('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    setUserCookie(res, signUserToken(user));
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post('/logout', (req, res) => {
  clearUserCookie(res);
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  requireUser,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  }),
);

authRouter.post(
  '/forgot-password',
  authLimiter,
  validate(z.object({ email: emailSchema })),
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await q1('SELECT id, email, full_name FROM users WHERE email = ?', [email]);
    const genericMessage =
      'If an account exists for that email, a password reset link has been created.';

    if (!user) {
      // Do not leak account existence.
      return res.json({ message: genericMessage, emailSent: false });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await q(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))',
      [user.id, tokenHash],
    );

    const resetUrl = `${config.appUrl}/reset-password?token=${token}`;
    const delivery = await sendPasswordResetEmail(user, resetUrl);

    await insert(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES (?, 'system', 'Password reset requested', ?, NULL)`,
      [
        user.id,
        delivery.status === 'sent'
          ? 'A password reset link was emailed to you. It expires in 30 minutes.'
          : 'A password reset was requested. If email delivery is not configured, use the reset link shown on screen.',
      ],
    );

    res.json({
      message: genericMessage,
      emailSent: delivery.status === 'sent',
      delivery: delivery.status,
      // Only for local/demo use when no email provider is configured.
      resetToken: config.exposeResetToken && delivery.status !== 'sent' ? token : undefined,
      resetUrl: config.exposeResetToken && delivery.status !== 'sent' ? resetUrl : undefined,
      note:
        delivery.status === 'sent'
          ? undefined
          : 'Email delivery is not configured on this deployment, so the reset link is returned here instead of being emailed.',
    });
  }),
);

authRouter.post(
  '/reset-password',
  authLimiter,
  validate(
    z.object({
      token: z.string().min(20, 'Reset token is invalid.'),
      password: passwordSchema,
      confirmPassword: z.string().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { token, password, confirmPassword } = req.body;
    if (confirmPassword !== undefined && password !== confirmPassword) {
      throw badRequest('Passwords do not match.');
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const row = await q1(
      `SELECT * FROM password_resets
        WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
        ORDER BY id DESC LIMIT 1`,
      [tokenHash],
    );
    if (!row) throw badRequest('This reset link is invalid or has expired. Please request a new one.');
    const hash = await bcrypt.hash(password, 12);
    await q('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id]);
    await q('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [row.id]);
    clearUserCookie(res);
    res.json({ message: 'Password updated. You can sign in with your new password.' });
  }),
);
