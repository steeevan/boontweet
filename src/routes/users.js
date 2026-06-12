// ===========================================================================
// routes/users.js — public profile pages + editing your own profile.
// ===========================================================================
// A profile is: the user's info (name, bio, join date) + the tweets they
// wrote. Anyone can VIEW a profile. Only the logged-in user can EDIT their
// own profile (via the Settings page, which calls PUT /api/users/me).
// ===========================================================================

const express = require('express');
const pool = require('../db');
const { requireLogin } = require('./auth');

const router = express.Router();

const MAX_DISPLAY_NAME = 50;
const MAX_BIO = 160;

// ---------------------------------------------------------------------------
// PUT /api/users/me  -> update the logged-in user's display name and bio.
// ---------------------------------------------------------------------------
// NOTE: this is defined BEFORE "/:username" below. Order matters in Express —
// it tries routes top to bottom. (They're different HTTP methods here, so
// there's no real clash, but keeping "me" first is a good habit.)
router.put('/me', requireLogin, async (req, res, next) => {
  try {
    // Trim, then turn an empty string into NULL so "cleared" fields are blank.
    let displayName = (req.body.display_name || '').trim() || null;
    let bio = (req.body.bio || '').trim() || null;

    if (displayName && displayName.length > MAX_DISPLAY_NAME) {
      return res.status(400).json({ error: `Display name can be at most ${MAX_DISPLAY_NAME} characters.` });
    }
    if (bio && bio.length > MAX_BIO) {
      return res.status(400).json({ error: `Bio can be at most ${MAX_BIO} characters.` });
    }

    const result = await pool.query(
      `UPDATE users
         SET display_name = $1, bio = $2
       WHERE id = $3
       RETURNING id, username, display_name, bio, created_at`,
      [displayName, bio, req.session.userId]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/users/:username  -> { user, posts }
// ---------------------------------------------------------------------------
router.get('/:username', async (req, res, next) => {
  try {
    const { username } = req.params;

    // 1) Find the user.
    const userResult = await pool.query(
      'SELECT id, username, display_name, bio, created_at FROM users WHERE username = $1',
      [username]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = userResult.rows[0];

    // 2) Find that user's tweets, newest first. We include the same
    //    like_count / liked_by_me / image_url fields the feed uses so the
    //    Profile page can reuse the exact same Tweet component on the frontend.
    //    $1 = the profile owner's id, $2 = the *viewer's* id (for liked_by_me).
    const viewerId = req.session.userId || null;
    const postsResult = await pool.query(
      `SELECT
         p.id,
         p.content,
         p.image_url,
         p.created_at,
         u.username,
         u.display_name,
         COUNT(l.id)::int AS like_count,
         COALESCE(BOOL_OR(l.user_id = $2), false) AS liked_by_me
       FROM posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN likes l ON l.post_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id, u.username, u.display_name
       ORDER BY p.created_at DESC, p.id DESC`,
      [user.id, viewerId]
    );

    res.json({ user, posts: postsResult.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
