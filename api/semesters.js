const { login, getSemesters } = require('../lib/portal');
const { requireAuth } = require('../lib/crypto');

module.exports = async (req, res) => {
  const auth = requireAuth(req, res); if (!auth) return;
  try {
    const r = await login(auth.u, auth.p);
    if (!r.success) return res.status(401).json({ error: 'Portal session expired — please log in again.' });
    const semesters = await getSemesters(r.client);
    return res.json({ semesters });
  } catch (e) {
    console.error(e); return res.status(502).json({ error: 'Failed to fetch semesters' });
  }
};