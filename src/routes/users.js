// ===========================================================================
// routes/users.js — public profile pages + editing your own profile.
// ===========================================================================
// A profile is: the user's info (name, bio, join date) + the tweets they
// wrote AND the tweets they retweeted. Anyone can VIEW a profile; only the
// logged-in user can EDIT their own (via Settings -> PUT /api/users/me).
// ===========================================================================

const express = require('express');
const pool = require('../db');
const { requireLogin } = require('./auth');
// Reuse the exact same post columns/counts the feed uses, so a tweet looks
// identical whether you see it in the feed or on a profile.
const { POST_FIELDS } = require('./posts');

const router = express.Router();

const MAX_DISPLAY_NAME = 50;
const MAX_BIO = 160;

// ---------------------------------------------------------------------------
// PUT /api/users/me  -> update the logged-in user's display name and bio.
// ---------------------------------------------------------------------------
router.put('/me', requireLogin, async (req, res, next) => {
  try {
    let displayName = (req.body.display_name || '').trim() || null;
    let bio = (req.body.bio || '').trim() || null;

    if (displayName && displayName.length > MAX_DISPLAY_NAME) {
      return res.status(400).json({ error: `Display name can be at most ${MAX_DISPLAY_NAME} characters.` });
    }
    if (bio && bio.length > MAX_BIO) {
      return res.status(400).json({ error: `Bio can be at most ${MAX_BIO} characters.` });
    }

    const result = await pool.query(
      `UPDATE users SET display_name = $1, bio = $2
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

    const userResult = await pool.query(
      'SELECT id, username, display_name, bio, created_at FROM users WHERE username = $1',
      [username]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = userResult.rows[0];

    // The user's own tweets + the tweets they retweeted (same UNION idea as
    // the main feed). $1 = the VIEWER (for liked/retweeted flags),
    // $2 = the profile owner.
    const viewerId = req.session.userId || null;
    const postsResult = await pool.query(
      `SELECT ${POST_FIELDS}, NULL::text AS retweeted_by, p.created_at AS sort_time
         FROM posts p JOIN users u ON u.id = p.user_id
        WHERE p.user_id = $2
       UNION ALL
       SELECT ${POST_FIELDS}, ru.username AS retweeted_by, r.created_at AS sort_time
         FROM retweets r
         JOIN posts p ON p.id = r.post_id
         JOIN users u ON u.id = p.user_id
         JOIN users ru ON ru.id = r.user_id
        WHERE r.user_id = $2
        ORDER BY sort_time DESC, id DESC`,
      [viewerId, user.id]
    );

    res.json({ user, posts: postsResult.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
