const crypto = require('crypto');

const KEY = crypto.createHash('sha256')
  .update(process.env.TOKEN_SECRET || 'change-me-in-vercel-env')
  .digest();

function encryptToken(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

function decryptToken(token) {
  if (!token) return null;
  try {
    const buf = Buffer.from(token, 'base64url');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    const payload = JSON.parse(dec.toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function requireAuth(req, res) {
  const token = req.headers['x-auth-token'] || req.query.token;
  const auth = decryptToken(token);
  if (!auth) { res.status(401).json({ error: 'Unauthorized or expired' }); return null; }
  return auth;
}

module.exports = { encryptToken, decryptToken, requireAuth };