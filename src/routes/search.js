// ===========================================================================
// routes/search.js — search people and tweets.
// ===========================================================================
// GET /api/search?q=...  ->  { users, posts }
//   - users: username or display name matches (case-insensitive)
//   - posts: tweet text matches (so a "#hashtag" search just finds tweets
//     whose text contains that hashtag — no separate hashtag table needed)
// ===========================================================================

const express = require('express');
const pool = require('../db');
const { POST_FIELDS } = require('./posts'); // reuse the exact feed columns

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const viewerId = req.session.userId || null;
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [], posts: [] });

    // Escape LIKE wildcards so a literal % or _ in the query isn't treated as
    // a pattern. (Postgres LIKE/ILIKE uses backslash as the default escape.)
    const like = '%' + q.replace(/[%_\\]/g, '\\$&') + '%';

    const users = await pool.query(
      `SELECT username, display_name, avatar_url, avatar_anim, bio
         FROM users
        WHERE username ILIKE $1 OR display_name ILIKE $1
        ORDER BY (username ILIKE $1) DESC, username ASC
        LIMIT 20`,
      [like]
    );

    const posts = await pool.query(
      `SELECT ${POST_FIELDS}, NULL::text AS retweeted_by, p.created_at AS sort_time
         FROM posts p JOIN users u ON u.id = p.user_id
        WHERE p.content ILIKE $2
        ORDER BY p.created_at DESC
        LIMIT 30`,
      [viewerId, like]
    );

    res.json({ users: users.rows, posts: posts.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
