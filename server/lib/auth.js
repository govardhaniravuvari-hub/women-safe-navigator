import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { q1 } from '../db/pool.js';
import { unauthorized, forbidden } from './http.js';

export function signUserToken(user) {
  return jwt.sign({ sub: user.id, kind: 'user' }, config.jwtSecret, {
    expiresIn: config.jwtExpires,
  });
}

export function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, kind: 'admin', role: admin.role }, config.jwtSecret, {
    expiresIn: '12h',
  });
}

export function setUserCookie(res, token) {
  res.cookie(config.cookie.user, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookie.secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearUserCookie(res) {
  res.clearCookie(config.cookie.user, { path: '/' });
}

export function setAdminCookie(res, token) {
  res.cookie(config.cookie.admin, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookie.secure,
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAdminCookie(res) {
  res.clearCookie(config.cookie.admin, { path: '/' });
}

function readToken(req, name) {
  const cookieToken = req.cookies?.[name];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Attaches req.user (safe public fields) or responds 401. */
export async function requireUser(req, res, next) {
  try {
    const token = readToken(req, config.cookie.user);
    if (!token) throw unauthorized();
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw unauthorized('Your session has expired. Please sign in again.');
    }
    if (payload.kind !== 'user') throw unauthorized();
    const user = await q1(
      `SELECT id, full_name, email, phone, city, blood_group, medical_notes, status, created_at
         FROM users WHERE id = ?`,
      [payload.sub],
    );
    if (!user) throw unauthorized('Account not found.');
    if (user.status === 'suspended') throw forbidden('This account is suspended. Contact support.');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Attaches req.admin or responds 401/403. */
export async function requireAdmin(req, res, next) {
  try {
    const token = readToken(req, config.cookie.admin);
    if (!token) throw unauthorized('Administrator sign-in required.');
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw unauthorized('Administrator session expired.');
    }
    if (payload.kind !== 'admin') throw forbidden('Administrator access only.');
    const admin = await q1(
      'SELECT id, name, email, role, is_active FROM admins WHERE id = ?',
      [payload.sub],
    );
    if (!admin || !admin.is_active) throw forbidden('Administrator access only.');
    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

/** Blocks state-changing requests coming from a foreign Origin. */
export function sameOriginGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // same-origin fetches and non-browser clients
  try {
    const host = new URL(origin).host;
    if (host === req.headers.host) return next();
  } catch {
    /* malformed origin -> reject below */
  }
  return res.status(403).json({ error: 'Cross-origin request rejected.' });
}
