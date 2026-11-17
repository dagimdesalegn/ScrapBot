const crypto = require('crypto');
const zlib = require('zlib');
const { CookieJar } = require('tough-cookie');

const KEY = crypto.createHash('sha256').update(process.env.TOKEN_SECRET || '').digest();

function encrypt(obj) {
  const buf = zlib.gzipSync(Buffer.from(JSON.stringify(obj), 'utf8'));
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64url');
}

function decrypt(token) {
  if (!token) return null;
  try {
    const buf = Buffer.from(token, 'base64url');
    const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), enc = buf.subarray(28);
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    d.setAuthTag(tag);
    const out = JSON.parse(zlib.gunzipSync(Buffer.concat([d.update(enc), d.final()])).toString());
    if (!out.exp || out.exp < Date.now()) return null;
    return out;
  } catch { return null; }
}

function readSession(req) {
  const header = req.headers.cookie || '';
  const p = header.split(';').map(s => s.trim()).find(s => s.startsWith('ju_sess='));
  return p ? decrypt(p.slice(8)) : null;
}

function writeSession(res, jar, ttl = 7200) {
  const token = encrypt({ jar: JSON.stringify(jar.serializeSync()), exp: Date.now() + ttl * 1000 });
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const attrs = [`ju_sess=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${ttl}`];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSession(res) {
  res.setHeader('Set-Cookie', 'ju_sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function requireSession(req, res) {
  const s = readSession(req);
  if (!s || !s.jar) { res.status(401).json({ error: 'Session expired. Sign in again.' }); return null; }
  return { jar: CookieJar.deserializeSync(JSON.parse(s.jar)) };
}

module.exports = { writeSession, clearSession, requireSession };
