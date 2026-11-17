const { login, getSemesterData } = require('../lib/portal');
const { requireAuth } = require('../lib/crypto');
const { summarizeSemester } = require('../lib/grades');

module.exports = async (req, res) => {
  const auth = requireAuth(req, res); if (!auth) return;
  const { value, name } = req.query;
  if (!value || !name) return res.status(400).json({ error: 'value and name are required' });
  try {
    const r = await login(auth.u, auth.p);
    if (!r.success) return res.status(401).json({ error: 'Portal session expired.' });
    const data = await getSemesterData(r.client, value, name);
    return res.json({ ...data, computed: summarizeSemester(data) });
  } catch (e) {
    console.error(e); return res.status(502).json({ error: 'Failed to fetch semester' });
  }
};