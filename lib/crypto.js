const crypto = require('crypto');
const zlib = require('zlib');

const KEY = crypto.createHash('sha256')
  .update(process.env.TOKEN_SECRET || '')
  .digest();

/** Encrypt { cookies, exp }. Nothing else. */
function encryptSession(payload) {
  const json = JSON.stringify(payload);
  const compressed = zlib.gzipSync(Buffer.from(json, 'utf8'));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

function decryptSession(token) {
  if (!token) return null;
  try {
    const buf = Buffer.from(token, 'base64url');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    const json = zlib.gunzipSync(dec).toString('utf8');
    const payload = JSON.parse(json);
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (!payload.cookies || typeof payload.cookies !== 'object') return null;
    return payload;
  } catch {
    return null;
  }
}

/** Read session cookie from request. */
function readSession(req) {
  const header = req.headers.cookie || '';
  const part = header.split(';').map(s => s.trim()).find(s => s.startsWith('ju_sess='));
  if (!part) return null;
  const token = part.slice('ju_sess='.length);
  return decryptSession(token);
}

/** Write session cookie to response. */
function writeSession(res, cookies, ttlSeconds = 7200) {
  const token = encryptSession({ cookies, exp: Date.now() + ttlSeconds * 1000 });
  const secure = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  const attrs = [
    `ju_sess=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${ttlSeconds}`,
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSession(res) {
  res.setHeader('Set-Cookie', 'ju_sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

/** Guard for API handlers. */
function requireSession(req, res) {
  const s = readSession(req);
  if (!s) { res.status(401).json({ error: 'Session expired. Please sign in again.' }); return null; }
  return s;
}

module.exports = { encryptSession, decryptSession, readSession, writeSession, clearSession, requireSession };
