// ===========================================================================
// server.js — the Express app. This is the file `npm start` runs.
// ===========================================================================
// Order of middleware matters:
//   1. helmet            — security HTTP headers (incl. a Content-Security-Policy)
//   2. express.json      — parse JSON request bodies
//   3. session           — remember who is logged in (stored in Postgres)
//   4. rate limiting      — slow down abuse / brute-force
//   5. CSRF protection    — block cross-site state-changing requests
//   6. API routes + static frontend
// One server serves both the API and the frontend, so it deploys to Render as
// a single web service.
// ===========================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const PgSession = require('connect-pg-simple')(session);

require('dotenv').config();

const pool = require('./db');

const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const mediaRoutes = require('./routes/media');
const sportsRoutes = require('./routes/sports');
const searchRoutes = require('./routes/search');
const exploreRoutes = require('./routes/explore');
const notificationRoutes = require('./routes/notifications');
const streamRoutes = require('./routes/stream');

const app = express();

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-insecure-secret';
// "Production" = deployed (Render sets RENDER=true). Used to turn on
// https-only cookies, which would break plain-http local development.
const isProd = process.env.NODE_ENV === 'production' || !!process.env.RENDER;

// Render puts the app behind a proxy; trusting it lets secure cookies + the
// rate limiter see the real client (one hop).
app.set('trust proxy', 1);

// --- 1) Security headers -----------------------------------------------------
// The CSP is hand-written because this app has no build step: React + Babel
// load from unpkg, and Babel compiles JSX in the browser (which needs
// 'unsafe-eval'). We DON'T use helmet's default CSP because its
// upgrade-insecure-requests breaks same-origin assets on local http.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://unpkg.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'], // uploads, previews, external links, crests, flags, thumbnails
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameSrc: ['https://www.youtube-nocookie.com', 'https://www.youtube.com'], // Explore video embeds
        frameAncestors: ["'self'"],
      },
    },
  })
);

// --- 2) Parse JSON bodies ---
app.use(express.json());

// --- 3) Sessions: remember who is logged in. ---
app.use(
  session({
    store: new PgSession({ pool, createTableIfMissing: true }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,                   // JS can't read the session cookie
      maxAge: 1000 * 60 * 60 * 24 * 7,  // stay logged in for 7 days
      sameSite: 'lax',                  // first line of CSRF defense
      secure: isProd,                   // https-only in production
    },
  })
);

// --- 4) Rate limiting --------------------------------------------------------
// A generous general cap, plus a much tighter cap on auth endpoints so nobody
// can brute-force passwords. Counters are per-IP and in-memory (reset on
// restart) — fine for one instance; use a shared store if you scale out.
// Skip GET reads (feed paging, search-as-you-type) so an active session can't
// lock itself out; the cap still covers mutations, and auth has its own limiter.
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, skip: (req) => req.method === 'GET' });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});
app.use('/api', generalLimiter);
app.use(['/api/auth/login', '/api/auth/signup'], authLimiter);

// --- 5) CSRF protection (stateless "double-submit cookie") -------------------
// We set a random token in a NON-httpOnly cookie. The frontend reads it and
// echoes it back in an `x-csrf-token` header on every state-changing request.
// A cross-site attacker can send our session cookie but CANNOT read the token
// cookie (same-origin policy) nor set our custom header, so forged requests
// fail. We never store the token server-side — we just compare header==cookie.
function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function csrfProtection(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  let token = cookies.csrf_token;
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    res.cookie('csrf_token', token, { httpOnly: false, sameSite: 'lax', secure: isProd, path: '/', maxAge: 1000 * 60 * 60 * 24 * 7 });
  }
  const mutating = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' || req.method === 'PATCH';
  if (mutating && req.get('x-csrf-token') !== token) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token. Refresh the page and try again.' });
  }
  next();
}
app.use('/api', csrfProtection);

// --- 6) API routes + static frontend ---
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/sports', sportsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stream', streamRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Central error handler. ---
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

// ---------------------------------------------------------------------------
// Start up: ensure the tables exist (schema.sql is idempotent), then listen.
// ---------------------------------------------------------------------------
async function start() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database schema is ready.');
    app.listen(PORT, () => console.log(`BoonTweet running at http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start — could not connect to the database:', err.message);
    process.exit(1);
  }
}

start();
