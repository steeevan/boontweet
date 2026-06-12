// ===========================================================================
// routes/auth.js — sign up, log in, log out, and "who am I?".
// ===========================================================================
// HOW LOGIN WORKS HERE:
//   1. On signup/login we verify the password, then store the user's id in
//      `req.session` (a server-side session, backed by Postgres).
//   2. The browser gets a cookie that points at that session.
//   3. On later requests, express-session reads the cookie and refills
//      `req.session.userId` for us. That's how the server "remembers" you.
// ===========================================================================

const express = require('express');
const bcrypt = require('bcryptjs'); // hashes passwords; pure-JS so it installs anywhere
const pool = require('../db');

const router = express.Router();

// Usernames must be URL-safe because they appear in /api/users/:username.
const USERNAME_RE = /^[A-Za-z0-9_]{1,30}$/;
const MIN_PASSWORD_LENGTH = 6;

// The user columns we send to the frontend (everything EXCEPT password_hash).
// Defined once and reused so signup / login / me / profile all agree.
const USER_COLS =
  'id, username, display_name, bio, avatar_url, banner_url, theme, avatar_anim, page_effect, created_at';

// ---------------------------------------------------------------------------
// requireLogin — middleware that blocks routes for logged-out users.
// ---------------------------------------------------------------------------
// We export this so other route files (like posts.js) can protect their
// routes by putting `requireLogin` in front of the handler.
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'You must be logged in to do that.' });
  }
  next(); // user is logged in — continue to the real handler
}

// ---------------------------------------------------------------------------
// POST /api/auth/signup  -> create an account and log the new user in.
// ---------------------------------------------------------------------------
router.post('/signup', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // --- validate input ---
    if (!USERNAME_RE.test(username || '')) {
      return res.status(400).json({
        error: 'Username must be 1–30 characters: letters, numbers, or underscores.',
      });
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
    }

    // --- make sure the username is free ---
    const existing = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    // --- hash the password and create the user ---
    // bcrypt automatically adds a random "salt" so identical passwords get
    // different hashes. The 10 is the "cost" (how slow/strong the hash is).
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING ${USER_COLS}`,
      [username, passwordHash]
    );
    const user = result.rows[0];

    // --- log them in by saving their id in the session ---
    req.session.userId = user.id;
    req.session.username = user.username;

    res.status(201).json({ user });
  } catch (err) {
    next(err); // hand any unexpected error to the central error handler
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login  -> verify password, start a session.
// ---------------------------------------------------------------------------
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const result = await pool.query(
      `SELECT ${USER_COLS}, password_hash FROM users WHERE username = $1`,
      [username]
    );
    const user = result.rows[0];

    // Compare the typed password against the stored hash. We give the SAME
    // vague error whether the username or the password was wrong, so an
    // attacker can't tell which usernames exist.
    const passwordOk = user && (await bcrypt.compare(password, user.password_hash));
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;

    // Return everything except the password hash.
    const { password_hash, ...publicUser } = user;
    res.json({ user: publicUser });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout  -> destroy the session.
// ---------------------------------------------------------------------------
router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid'); // remove the browser's session cookie
    res.status(204).end();          // 204 = success, no content to return
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me  -> the currently logged-in user, or null.
// ---------------------------------------------------------------------------
// The frontend calls this on page load to decide whether to show the
// compose box (logged in) or the login form (logged out).
router.get('/me', async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.json({ user: null });
    }
    const result = await pool.query(
      `SELECT ${USER_COLS} FROM users WHERE id = $1`,
      [req.session.userId]
    );
    res.json({ user: result.rows[0] || null });
  } catch (err) {
    next(err);
  }
});

// Export the router AND the middleware (posts.js needs requireLogin).
module.exports = router;
module.exports.requireLogin = requireLogin;
module.exports.USER_COLS = USER_COLS;
