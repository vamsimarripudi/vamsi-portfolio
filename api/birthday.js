import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'node:crypto';

const MAX_LINKS_PER_HOUR = 12;
const LINK_TTL_DAYS = 90;
const LINK_PATTERN = /^[A-Za-z0-9_-]{8,16}$/;
const attempts = new Map();

const clean = (value, max) => typeof value === 'string' ? Array.from(value, (character) => { const code = character.charCodeAt(0); return code === 10 || code === 13 ? character : (code < 32 || code === 127 ? ' ' : character); }).join('').trim().slice(0, max) : '';
const normalize = (value = {}) => {
  const recipientName = clean(value.recipientName, 60).replace(/\s+/g, ' ');
  const senderName = clean(value.senderName, 60).replace(/\s+/g, ' ') || 'Vamsi';
  const message = clean(value.message, 520);
  return recipientName && message ? { recipientName, senderName, message } : null;
};
const clientKey = (req) => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
const rateLimit = (key) => {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= MAX_LINKS_PER_HOUR) return false;
  recent.push(now); attempts.set(key, recent); return true;
};
const sql = () => {
  if (!process.env.DATABASE_URL) throw new Error('BIRTHDAY_STORAGE_UNAVAILABLE');
  return neon(process.env.DATABASE_URL);
};
const ensureTable = async (query) => {
  await query`CREATE TABLE IF NOT EXISTS birthday_share_links (
    id VARCHAR(16) PRIMARY KEY,
    payload_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
  )`;
  await query`CREATE INDEX IF NOT EXISTS birthday_share_links_expires_idx ON birthday_share_links (expires_at)`;
  await query`DELETE FROM birthday_share_links WHERE expires_at <= NOW()`;
};
const shortId = () => randomBytes(8).toString('base64url').slice(0, 11);
const sameOrigin = (req) => {
  const origin = req.headers.origin;
  if (!origin) return true;
  const preview = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  return new Set(['https://vamsimarripudi.tech', 'http://localhost:5173', preview]).has(origin);
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const query = sql();
    await ensureTable(query);
    if (req.method === 'GET') {
      const id = String(req.query?.id || '');
      if (!LINK_PATTERN.test(id)) return res.status(404).json({ ok: false, message: 'This birthday link is unavailable.' });
      const rows = await query`SELECT payload_json FROM birthday_share_links WHERE id = ${id} AND expires_at > NOW() LIMIT 1`;
      if (!rows[0]) return res.status(404).json({ ok: false, message: 'This birthday link is unavailable or has expired.' });
      return res.status(200).json({ ok: true, data: JSON.parse(rows[0].payload_json) });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, message: 'Method not allowed.' }); }
    if (!sameOrigin(req)) return res.status(403).json({ ok: false, message: 'This request was not accepted.' });
    if (!rateLimit(clientKey(req))) return res.status(429).json({ ok: false, message: 'Please wait before creating another birthday link.' });
    let body; try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body; } catch { return res.status(400).json({ ok: false, message: 'Please check your birthday message.' }); }
    const data = normalize(body);
    if (!data) return res.status(400).json({ ok: false, message: 'Add a name and message before creating the link.' });
    const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const id = shortId();
      try {
        await query`INSERT INTO birthday_share_links (id, payload_json, expires_at) VALUES (${id}, ${JSON.stringify(data)}, ${expiresAt})`;
        return res.status(201).json({ ok: true, id, expiresAt: expiresAt.toISOString() });
      } catch (error) { if (error?.code !== '23505') throw error; }
    }
    return res.status(503).json({ ok: false, message: 'Please try creating your birthday link again.' });
  } catch (error) {
    console.error('birthday_link.error', { code: error?.message || 'UNKNOWN' });
    return res.status(503).json({ ok: false, message: 'Birthday links are temporarily unavailable. Please try again shortly.' });
  }
}
