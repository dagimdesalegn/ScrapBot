const { login, getProfile, getSemesters } = require('../lib/portal');
const { writeSession } = require('../lib/crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const r = await login(String(username).trim(), String(password));
    if (!r.ok) return res.status(401).json({ error: r.error });

    const [profile, semesters] = await Promise.all([
      getProfile(r.cookies).catch(() => ({})),
      getSemesters(r.cookies).catch(() => []),
    ]);

    writeSession(res, r.cookies, 7200); // 2-hour portal session
    return res.json({ ok: true, profile, semesters });
  } catch (e) {
    console.error('[login]', e.message);
    return res.status(502).json({ error: 'Portal unreachable. Try again in a moment.' });
  }
};
