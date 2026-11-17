const { getAllSemesters } = require('../lib/portal');
const { summarizeSemester } = require('../lib/grades');
const { requireSession } = require('../lib/crypto');

module.exports = async (req, res) => {
  const s = requireSession(req, res); if (!s) return;
  try {
    const semesters = await getAllSemesters(s.jar, 4);
    return res.json({
      semesters: semesters.map(x => ({ ...x, computed: summarizeSemester(x.data || {}) })),
    });
  } catch (e) {
    if (/rejected/i.test(e.message)) return res.status(401).json({ error: 'Session expired' });
    console.log('[all-semesters]', e.message);
    return res.status(502).json({ error: 'Portal request failed' });
  }
};
