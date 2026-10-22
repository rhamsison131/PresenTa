const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const db = require('./db');
const auth = require('./auth');

const app = express();

// 1. Robust CORS for Vercel and Localhost
app.use(cors({
  origin: [
    'http://localhost:4000', 
    'http://localhost:3000', 
    /\.vercel\.app$/ // Allows all your Vercel deployments
  ],
  credentials: true
}));

app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// 2. Database & Seeding Middleware
app.use(async (req, res, next) => {
  try {
    await db.ready;
    
    // Check if a superadmin exists instead of using a global variable (safe for Vercel)
    const hasSuperAdmin = db.data.users.some(u => u.role === 'superadmin');
    if (!hasSuperAdmin) {
      await auth.seed();
    }
  } catch (err) {
    console.error("Middleware Error:", err);
    return res.status(503).json({ message: 'Database unavailable' });
  }

  // Ensure data is flushed before the response ends
  const end = res.end.bind(res);
  res.end = (...args) => {
    db.flush().then(() => end(...args)).catch(e => {
        console.error("Flush error:", e);
        end(...args);
    });
    return res;
  };
  next();
});

// 3. Mount Routes
auth.mount(app);
require('./events').mount(app);
require('./admin').mount(app);

// 4. Cron Job Route
app.get('/api/cron/sweep', (req, res) => {
  if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  db.sweepAccreditation();
  res.json({ ok: true });
});

// 5. Error Handling
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.status === 400 ? 'Invalid request' : 'Server error' });
});

// 6. Export for Vercel
module.exports = app;

// 7. Local Development Listener
if (require.main === module) {
  const PORT = Number(process.env.PORT) || 4000;
  app.listen(PORT, '0.0.0.0', () => console.log('Presenta running on http://localhost:' + PORT));
}