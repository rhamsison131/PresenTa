const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const auth = require('./auth');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

auth.mount(app);
require('./events').mount(app);
require('./admin').mount(app);

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.status === 400 ? 'Invalid request' : 'Server error' });
});

const PORT = Number(process.env.PORT) || 4000;
auth.seed().then(() => {
  db.sweepAccreditation();
  setInterval(db.sweepAccreditation, 10 * 60 * 1000);
  app.listen(PORT, '0.0.0.0', () => console.log('Presenta running on http://localhost:' + PORT));
});