// ===========================================================================
// server.js — the Express app. This is the file `npm start` runs.
// ===========================================================================
// It does four things, in order:
//   1. Parse JSON request bodies.
//   2. Set up logged-in sessions (stored in Postgres).
//   3. Mount the API routes  (/api/auth, /api/posts, /api/users).
//   4. Serve the frontend in /public as static files.
// Because the SAME server does both the API and the frontend, the whole app
// runs from one process — and deploys to Render as a single web service.
// ===========================================================================

const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session); // stores sessions in Postgres

require('dotenv').config();

const pool = require('./db');

// Route handlers (each is an Express Router).
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');

const app = express();

// Read config from the environment, with friendly local defaults.
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-insecure-secret';

// Render (and most hosts) put your app behind a proxy. This lets express
// trust that proxy — needed if you later turn on secure (https-only) cookies.
app.set('trust proxy', 1);

// --- 1) Parse JSON bodies, so req.body works on POST/PUT requests. ---
app.use(express.json());

// --- 2) Sessions: remember who is logged in. ---
app.use(
  session({
    store: new PgSession({
      pool,                       // reuse our one shared connection pool
      createTableIfMissing: true, // create the "session" table if it isn't there
    }),
    secret: SESSION_SECRET,       // signs the cookie so it can't be tampered with
    resave: false,                // don't re-save unchanged sessions
    saveUninitialized: false,     // don't create empty sessions for anonymous visitors
    cookie: {
      httpOnly: true,                          // JS in the browser can't read the cookie
      maxAge: 1000 * 60 * 60 * 24 * 7,         // stay logged in for 7 days
      sameSite: 'lax',
      // secure: true,  // <- turn this on in real production (requires https).
      //                //    We leave it off so login works on plain http locally.
    },
  })
);

// --- 3) API routes. The order is "mount path" + the router that handles it. ---
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);

// --- 4) Serve the frontend. Anything not matched above is looked up in /public. ---
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Central error handler. Any route that calls next(err) lands here. ---
// We log the real error for ourselves, but send the user a generic message
// so we never leak internal details.
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`BoonTweet running at http://localhost:${PORT}`);
});
