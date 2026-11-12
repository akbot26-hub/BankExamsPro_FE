import jwt from 'jsonwebtoken';
import { db } from './store.js';

const SECRET = process.env.JWT_SECRET || 'bankexamspro-dev-secret-change-me';
const TTL = '12h';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: TTL });

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db().users.find((u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ error: 'This account no longer exists.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Your session expired. Sign in again.' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}
