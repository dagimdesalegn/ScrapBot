const { getSemesters } = require('../lib/portal');
const { requireSession } = require('../lib/crypto');

module.exports = async (req, res) => {
  const s = requireSession(req, res); if (!s) return;
  try {
    const semesters = await getSemesters(s.cookies);
    return res.json({ semesters });
  } catch (e) {
    if (/rejected/i.test(e.message)) return res.status(401).json({ error: 'Session expired' });
    console.error('[semesters]', e.message);
    return res.status(502).json({ error: 'Portal request failed' });
  }
};
