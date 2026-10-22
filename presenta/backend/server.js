const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const db = require('./db');
const auth = require('./auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

let seeded = false;
app.use(async (req, res, next) => {
  try {
    await db.ready;
    if (!seeded) {
      await auth.seed();
      seeded = true;
    }
  } catch (err) {
    return res.status(503).json({ message: 'Database unavailable' });
  }
  const end = res.end.bind(res);
  res.end = (...args) => {
    db.flush().then(() => end(...args));
    return res;
  };
  next();
});

auth.mount(app);
require('./events').mount(app);
require('./admin').mount(app);

app.get('/api/cron/sweep', (req, res) => {
  if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  db.sweepAccreditation();
  res.json({ ok: true });
});

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.status === 400 ? 'Invalid request' : 'Server error' });
});

module.exports = app;

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 4000;
  app.listen(PORT, '0.0.0.0', () => console.log('Presenta running on http://localhost:' + PORT));
}