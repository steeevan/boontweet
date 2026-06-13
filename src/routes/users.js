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
const { notify } = require('./notifications');

const router = express.Router();

const MAX_DISPLAY_NAME = 50;
const MAX_BIO = 160;
const MAX_URL = 500;

// The 8 themes from the design. Anything not in this list falls back to 'neon'.
const THEMES = ['neon', 'light', 'y2k', 'brutalist', 'terminal', 'glass', 'editorial', 'cozy'];

// A media URL must be one of ours (/api/media/..) or an external http(s) link.
function validMediaUrl(u) {
  return !u || (u.length <= MAX_URL && /^(https?:\/\/|\/api\/media\/)/i.test(u));
}

// ---------------------------------------------------------------------------
// PUT /api/users/me  -> update the logged-in user's profile + appearance.
// ---------------------------------------------------------------------------
// PARTIAL update: we only change the fields that are actually present in the
// request body. That way the Settings page can save name/bio without wiping
// the theme, and the Appearance panel can save just the theme without wiping
// the bio. Each field is validated; unknown fields are ignored.
router.put('/me', requireLogin, async (req, res, next) => {
  try {
    const b = req.body || {};
    const sets = [];   // "column = $n" fragments
    const params = []; // matching values

    // Helper: queue a column update with a validated value.
    const set = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };

    if ('display_name' in b) {
      const v = (b.display_name || '').trim() || null;
      if (v && v.length > MAX_DISPLAY_NAME) return res.status(400).json({ error: `Display name can be at most ${MAX_DISPLAY_NAME} characters.` });
      set('display_name', v);
    }
    if ('bio' in b) {
      const v = (b.bio || '').trim() || null;
      if (v && v.length > MAX_BIO) return res.status(400).json({ error: `Bio can be at most ${MAX_BIO} characters.` });
      set('bio', v);
    }
    if ('avatar_url' in b) {
      const v = (b.avatar_url || '').trim() || null;
      if (!validMediaUrl(v)) return res.status(400).json({ error: 'Avatar URL must be an uploaded image or start with http(s).' });
      set('avatar_url', v);
    }
    if ('banner_url' in b) {
      const v = (b.banner_url || '').trim() || null;
      if (!validMediaUrl(v)) return res.status(400).json({ error: 'Banner URL must be an uploaded image or start with http(s).' });
      set('banner_url', v);
    }
    if ('theme' in b) set('theme', THEMES.includes(b.theme) ? b.theme : 'neon');

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    params.push(req.session.userId);
    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${USER_COLS}`,
      params
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/users/:username/follow  /  DELETE … — follow / unfollow a user.
// ---------------------------------------------------------------------------
router.post('/:username/follow', requireLogin, async (req, res, next) => {
  try {
    const target = await pool.query('SELECT id FROM users WHERE username = $1', [req.params.username]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const targetId = target.rows[0].id;
    if (targetId === req.session.userId) return res.status(400).json({ error: "You can't follow yourself." });
    // ON CONFLICT DO NOTHING: following twice is harmless (UNIQUE constraint).
    await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.session.userId, targetId]
    );
    notify({ userId: targetId, actorId: req.session.userId, type: 'follow' });
    res.status(201).json({ following: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:username/follow', requireLogin, async (req, res, next) => {
  try {
    const target = await pool.query('SELECT id FROM users WHERE username = $1', [req.params.username]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    await pool.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [
      req.session.userId,
      target.rows[0].id,
    ]);
    res.status(200).json({ following: false });
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
    const viewerId = req.session.userId || null;

    // User info + follower/following counts + does the viewer follow them.
    const userResult = await pool.query(
      `SELECT ${USER_COLS},
         (SELECT COUNT(*) FROM follows f WHERE f.following_id = users.id)::int AS follower_count,
         (SELECT COUNT(*) FROM follows f WHERE f.follower_id  = users.id)::int AS following_count,
         EXISTS (SELECT 1 FROM follows f WHERE f.following_id = users.id AND f.follower_id = $2) AS is_following
       FROM users WHERE username = $1`,
      [username, viewerId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = userResult.rows[0];

    // The user's own tweets + the tweets they retweeted. $1 = viewer, $2 = owner.
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
