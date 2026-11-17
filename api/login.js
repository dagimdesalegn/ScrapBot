const { login, getProfile } = require('../lib/portal');
const { encryptToken } = require('../lib/crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  try {
    const r = await login(String(username).trim(), String(password));
    if (!r.success) return res.status(401).json({ error: r.error });
    const profile = await getProfile(r.client);
    const token = encryptToken({
      u: String(username).trim(), p: String(password),
      exp: Date.now() + 24 * 60 * 60 * 1000,
    });
    return res.json({ token, profile });
  } catch (err) {
    console.error('login error', err);
    return res.status(502).json({ error: 'Portal is unreachable. Try again shortly.' });
  }
};