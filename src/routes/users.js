// ===========================================================================
// routes/users.js — public profile pages + editing your own profile.
// ===========================================================================
// A profile shows the user's info (name, bio, avatar, banner, join date) plus
// the tweets they wrote AND retweeted. Anyone can VIEW a profile; only the
// logged-in user can EDIT their own (Settings -> PUT /api/users/me).
// ===========================================================================

const express = require('express');
const pool = require('../db');
const { requireLogin, USER_COLS } = require('./auth');
// Reuse the exact post columns the feed uses, so a tweet looks identical
// whether you see it in the feed or on a profile.
const { POST_FIELDS } = require('./posts');

const router = express.Router();

const MAX_DISPLAY_NAME = 50;
const MAX_BIO = 160;
const MAX_URL = 500;

// The allowed choices for the appearance options. Anything not in these lists
// is ignored (falls back to a safe default), so a user can't inject odd values.
const THEMES = ['neon', 'sunset', 'matrix', 'bubblegum'];
const MASCOTS = ['bird', 'fox', 'alien', 'star', 'ghost'];
const EFFECTS = ['aurora', 'particles', 'stars'];

// A media URL must be one of ours (/api/media/..) or an external http(s) link.
function validMediaUrl(u) {
  return !u || (u.length <= MAX_URL && /^(https?:\/\/|\/api\/media\/)/i.test(u));
}

// ---------------------------------------------------------------------------
// PUT /api/users/me  -> replace the logged-in user's profile + appearance.
// ---------------------------------------------------------------------------
// The Settings page always sends the full set of fields, so this overwrites
// them all (sending an empty value clears that field).
router.put('/me', requireLogin, async (req, res, next) => {
  try {
    const b = req.body;
    const displayName = (b.display_name || '').trim() || null;
    const bio = (b.bio || '').trim() || null;
    const avatarUrl = (b.avatar_url || '').trim() || null;
    const bannerUrl = (b.banner_url || '').trim() || null;
    const theme = THEMES.includes(b.theme) ? b.theme : 'neon';
    const avatarAnim = MASCOTS.includes(b.avatar_anim) ? b.avatar_anim : null;
    const pageEffect = EFFECTS.includes(b.page_effect) ? b.page_effect : null;

    if (displayName && displayName.length > MAX_DISPLAY_NAME) {
      return res.status(400).json({ error: `Display name can be at most ${MAX_DISPLAY_NAME} characters.` });
    }
    if (bio && bio.length > MAX_BIO) {
      return res.status(400).json({ error: `Bio can be at most ${MAX_BIO} characters.` });
    }
    if (!validMediaUrl(avatarUrl) || !validMediaUrl(bannerUrl)) {
      return res.status(400).json({ error: 'Image URLs must be uploaded images or start with http(s).' });
    }

    const result = await pool.query(
      `UPDATE users
          SET display_name = $1, bio = $2, avatar_url = $3, banner_url = $4,
              theme = $5, avatar_anim = $6, page_effect = $7
        WHERE id = $8
        RETURNING ${USER_COLS}`,
      [displayName, bio, avatarUrl, bannerUrl, theme, avatarAnim, pageEffect, req.session.userId]
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
      `SELECT ${USER_COLS} FROM users WHERE username = $1`,
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
