const { clearSession } = require('../lib/crypto');
module.exports = (req, res) => { clearSession(res); res.json({ ok: true }); };
