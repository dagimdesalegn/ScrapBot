const { getSemesterData } = require('../lib/portal');
const { summarizeSemester } = require('../lib/grades');
const { requireSession } = require('../lib/crypto');

module.exports = async (req, res) => {
  const s = requireSession(req, res); if (!s) return;
  const { value, name } = req.query;
  if (!value || !name) return res.status(400).json({ error: 'value and name required' });
  try {
    const data = await getSemesterData(s.cookies, value, name);
    return res.json({ ...data, computed: summarizeSemester(data) });
  } catch (e) {
    if (/rejected/i.test(e.message)) return res.status(401).json({ error: 'Session expired' });
    console.error('[semester]', e.message);
    return res.status(502).json({ error: 'Portal request failed' });
  }
};
