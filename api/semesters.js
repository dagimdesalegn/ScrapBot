const { getSemesters } = require('../lib/portal');
const { requireSession } = require('../lib/crypto');

module.exports = async (req, res) => {
  const s = requireSession(req, res); if (!s) return;
  try { return res.json({ semesters: await getSemesters(s.jar) }); }
  catch (e) {
    if (/rejected/i.test(e.message)) return res.status(401).json({ error: 'Session expired' });
    console.log('[semesters]', e.message);
    return res.status(502).json({ error: 'Portal request failed' });
  }
};
