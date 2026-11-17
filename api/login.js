const { login, getProfile, getSemesters } = require('../lib/portal');
const { writeSession } = require('../lib/crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const r = await login(String(username).trim(), String(password));
    if (!r.ok) return res.status(r.status || 401).json({ error: r.error });

    const [profile, semesters] = await Promise.all([
      getProfile(r.jar).catch(() => ({})),
      getSemesters(r.jar).catch(() => []),
    ]);

    writeSession(res, r.jar, 7200);
    return res.json({ ok: true, profile, semesters });
  } catch (e) {
    console.log('[login] exception:', e.message);
    return res.status(502).json({ error: 'Portal unreachable. Try again shortly.' });
  }
};
