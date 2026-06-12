// ===========================================================================
// routes/posts.js — the feed, creating/deleting tweets, and likes.
// ===========================================================================
// SECURITY NOTE: every query below uses PARAMETERIZED values ($1, $2, ...).
// We never glue user input into the SQL string by hand. This is what makes
// us safe from SQL injection BY DEFAULT — the database treats $1 as data,
// never as code, no matter what the user typed.
// ===========================================================================

const express = require('express');
const pool = require('../db');
const { requireLogin } = require('./auth');

const router = express.Router();

const MAX_TWEET_LENGTH = 280;
const MAX_IMAGE_URL_LENGTH = 500;

// This SELECT is reused by several routes. It returns each post plus:
//   - username + display_name (who wrote it),
//   - image_url    (optional picture to show),
//   - like_count   (how many likes it has),
//   - liked_by_me  (did the CURRENT user like it? — drives the like button).
// $1 is the current user's id, or null when logged out.
const FEED_SELECT = `
  SELECT
    p.id,
    p.content,
    p.image_url,
    p.created_at,
    u.username,
    u.display_name,
    COUNT(l.id)::int AS like_count,
    COALESCE(BOOL_OR(l.user_id = $1), false) AS liked_by_me
  FROM posts p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN likes l ON l.post_id = p.id
`;

// We must list every non-aggregated column we SELECT in GROUP BY.
const FEED_GROUP_BY = 'GROUP BY p.id, u.username, u.display_name';

// Validate an optional image URL. Returns an error string, or null if OK.
// We only allow LINKING to an image (http/https), not uploading files —
// that keeps the app simple and deploy-friendly.
function validateImageUrl(imageUrl) {
  if (!imageUrl) return null; // image is optional
  if (imageUrl.length > MAX_IMAGE_URL_LENGTH) return 'Image URL is too long.';
  if (!/^https?:\/\/.+/i.test(imageUrl)) return 'Image URL must start with http:// or https://';
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/posts  -> the whole feed, newest first.
// ---------------------------------------------------------------------------
// Open to everyone (logged out users can still read the feed).
router.get('/', async (req, res, next) => {
  try {
    const currentUserId = req.session.userId || null;
    const result = await pool.query(
      `${FEED_SELECT}
       ${FEED_GROUP_BY}
       ORDER BY p.created_at DESC, p.id DESC`,
      [currentUserId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/posts  -> create a tweet. Must be logged in.
// ---------------------------------------------------------------------------
router.post('/', requireLogin, async (req, res, next) => {
  try {
    // .trim() so a tweet of only spaces counts as empty.
    const content = (req.body.content || '').trim();
    const imageUrl = (req.body.image_url || '').trim() || null;

    if (content.length === 0) {
      return res.status(400).json({ error: 'A tweet cannot be empty.' });
    }
    if (content.length > MAX_TWEET_LENGTH) {
      return res.status(400).json({
        error: `A tweet can be at most ${MAX_TWEET_LENGTH} characters.`,
      });
    }
    const imageError = validateImageUrl(imageUrl);
    if (imageError) {
      return res.status(400).json({ error: imageError });
    }

    // Insert, then re-fetch the new row in the SAME shape the feed uses, so
    // the frontend can drop it straight into the list (with username,
    // display_name, like_count, etc. all filled in correctly).
    const inserted = await pool.query(
      'INSERT INTO posts (user_id, content, image_url) VALUES ($1, $2, $3) RETURNING id',
      [req.session.userId, content, imageUrl]
    );
    const newId = inserted.rows[0].id;

    const result = await pool.query(
      `${FEED_SELECT} WHERE p.id = $2 ${FEED_GROUP_BY}`,
      [req.session.userId, newId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/posts/:id  -> delete a tweet. Must own it.
// ---------------------------------------------------------------------------
router.delete('/:id', requireLogin, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) {
      return res.status(400).json({ error: 'Invalid post id.' });
    }

    const found = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (found.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found.' }); // 404 = doesn't exist
    }
    if (found.rows[0].user_id !== req.session.userId) {
      return res.status(403).json({ error: 'You can only delete your own tweets.' }); // 403 = not allowed
    }

    // The likes for this post are removed automatically (ON DELETE CASCADE).
    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
    res.status(204).end(); // 204 = success, nothing to send back
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/posts/:id/like  -> like a tweet. Must be logged in.
// ---------------------------------------------------------------------------
router.post('/:id/like', requireLogin, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) {
      return res.status(400).json({ error: 'Invalid post id.' });
    }

    // Make sure the post exists before we try to like it.
    const post = await pool.query('SELECT 1 FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    // ON CONFLICT DO NOTHING: if the user already liked this post, the
    // UNIQUE(user_id, post_id) constraint would normally error — instead we
    // quietly do nothing. So liking twice is harmless (stays at one like).
    await pool.query(
      'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.session.userId, postId]
    );

    res.status(201).json({ liked: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/posts/:id/like  -> unlike a tweet. Must be logged in.
// ---------------------------------------------------------------------------
router.delete('/:id/like', requireLogin, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) {
      return res.status(400).json({ error: 'Invalid post id.' });
    }

    // Deleting a like that isn't there simply removes 0 rows — also harmless.
    await pool.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [
      req.session.userId,
      postId,
    ]);

    res.status(200).json({ liked: false });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
