const { login, getAllSemestersWithData } = require('../lib/portal');
const { requireAuth } = require('../lib/crypto');
const { summarizeSemester } = require('../lib/grades');

module.exports = async (req, res) => {
  const auth = requireAuth(req, res); if (!auth) return;
  try {
    const r = await login(auth.u, auth.p);
    if (!r.success) return res.status(401).json({ error: 'Portal session expired.' });
    const semesters = await getAllSemestersWithData(r.client);
    const enriched = semesters.map(s => ({
      ...s,
      computed: summarizeSemester(s.data),
    }));
    return res.json({ semesters: enriched });
  } catch (e) {
    console.error(e); return res.status(502).json({ error: 'Failed to fetch all semesters' });
  }
};