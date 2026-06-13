// ===========================================================================
// routes/posts.js — the feed, tweets, likes, retweets, and comments.
// ===========================================================================
// SECURITY NOTE: every query uses PARAMETERIZED values ($1, $2, ...). We never
// build SQL by string concatenation, so SQL injection can't happen.
// ===========================================================================

const express = require('express');
const pool = require('../db');
const { requireLogin } = require('./auth');
const { notify, notifyMentions } = require('./notifications');
const { emitAll } = require('../events');

const router = express.Router();

const MAX_TWEET_LENGTH = 280;
const MAX_COMMENT_LENGTH = 280;
const MAX_IMAGE_URL_LENGTH = 500;

// ---------------------------------------------------------------------------
// POST_FIELDS — the columns that describe one post, used everywhere a post is
// returned (feed, profile, single post). We compute the counts with small
// "scalar subqueries" instead of GROUP BY joins — it's easier to read and to
// add new counters to (likes, comments, retweets) without breaking grouping.
// $1 must be the VIEWER's user id (or null when logged out) for the
// liked_by_me / retweeted_by_me flags.
// ---------------------------------------------------------------------------
const POST_FIELDS = `
  p.id,
  p.content,
  p.image_url,
  p.created_at,
  u.username,
  u.display_name,
  u.avatar_url,
  u.avatar_anim,
  (SELECT COUNT(*) FROM likes    l  WHERE l.post_id  = p.id)::int AS like_count,
  (SELECT COUNT(*) FROM comments c  WHERE c.post_id  = p.id)::int AS comment_count,
  (SELECT COUNT(*) FROM retweets rt WHERE rt.post_id = p.id)::int AS retweet_count,
  EXISTS (SELECT 1 FROM likes    l  WHERE l.post_id  = p.id AND l.user_id  = $1) AS liked_by_me,
  EXISTS (SELECT 1 FROM retweets rt WHERE rt.post_id = p.id AND rt.user_id = $1) AS retweeted_by_me
`;

// Fetch a single post in the standard feed shape (used after creating one).
async function fetchPost(viewerId, postId) {
  const result = await pool.query(
    `SELECT ${POST_FIELDS}, NULL::text AS retweeted_by, p.created_at AS sort_time
       FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.id = $2`,
    [viewerId, postId]
  );
  return result.rows[0];
}

// Validate an optional image URL. Returns an error string, or null if OK.
function validateImageUrl(imageUrl) {
  if (!imageUrl) return null; // image is optional
  if (imageUrl.length > MAX_IMAGE_URL_LENGTH) return 'Image URL is too long.';
  // We allow either an external link OR an uploaded image we serve at /api/media/..
  if (!/^(https?:\/\/|\/api\/media\/)/i.test(imageUrl)) {
    return 'Image URL must start with http:// or https://';
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/posts  -> the feed: original tweets AND retweets, newest first.
// ---------------------------------------------------------------------------
// A "retweet" row appears as the same post but with retweeted_by set to the
// retweeter's username and sorted by WHEN it was retweeted. So one tweet can
// show up twice: once as the original, once as someone's retweet (just like
// a real timeline).
router.get('/', async (req, res, next) => {
  try {
    const viewerId = req.session.userId || null;
    // Pagination: one page, newest first. Next page = ?before=<sort_time of the
    // last item you have>. Keeps the feed fast no matter how many posts exist.
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const before = req.query.before || null;                                   // sort_time of last row
    const beforeId = req.query.before_id ? parseInt(req.query.before_id, 10) : null; // its id (tie-breaker)
    const following = req.query.scope === 'following';

    // "Following" feed: only posts/retweets by people the viewer follows (plus
    // the viewer's own). Requires login — logged-out gets an empty list.
    if (following && !viewerId) return res.json([]);
    const followFilter = (col) =>
      following ? `WHERE ${col} = $1 OR ${col} IN (SELECT following_id FROM follows WHERE follower_id = $1)` : '';

    // COMPOUND cursor matching ORDER BY (sort_time DESC, id DESC): comparing the
    // (sort_time, id) pair means rows that share a timestamp aren't skipped at a
    // page boundary. Params are appended positionally so there are never unused
    // placeholders (Postgres can't infer the type of an unreferenced param).
    const params = [viewerId];
    let cursorClause = '';
    if (before && beforeId != null) { params.push(before, beforeId); cursorClause = 'WHERE (feed.sort_time, feed.id) < ($2, $3)'; }
    else if (before) { params.push(before); cursorClause = 'WHERE feed.sort_time < $2'; }
    params.push(limit);
    const limitParam = '$' + params.length;

    const result = await pool.query(
      `SELECT * FROM (
         SELECT ${POST_FIELDS}, NULL::text AS retweeted_by, p.created_at AS sort_time
           FROM posts p JOIN users u ON u.id = p.user_id ${followFilter('p.user_id')}
         UNION ALL
         SELECT ${POST_FIELDS}, ru.username AS retweeted_by, r.created_at AS sort_time
           FROM retweets r
           JOIN posts p ON p.id = r.post_id
           JOIN users u ON u.id = p.user_id
           JOIN users ru ON ru.id = r.user_id ${followFilter('r.user_id')}
       ) feed
       ${cursorClause}
       ORDER BY feed.sort_time DESC, feed.id DESC
       LIMIT ${limitParam}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/posts/:id  -> a single tweet (used to open one from a notification).
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid post id.' });
    const post = await fetchPost(req.session.userId || null, id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    res.json(post);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/posts  -> create a tweet. Must be logged in.
// ---------------------------------------------------------------------------
router.post('/', requireLogin, async (req, res, next) => {
  try {
    const content = (req.body.content || '').trim();
    const imageUrl = (req.body.image_url || '').trim() || null;

    if (content.length === 0) {
      return res.status(400).json({ error: 'A tweet cannot be empty.' });
    }
    if (content.length > MAX_TWEET_LENGTH) {
      return res.status(400).json({ error: `A tweet can be at most ${MAX_TWEET_LENGTH} characters.` });
    }
    const imageError = validateImageUrl(imageUrl);
    if (imageError) {
      return res.status(400).json({ error: imageError });
    }

    const inserted = await pool.query(
      'INSERT INTO posts (user_id, content, image_url) VALUES ($1, $2, $3) RETURNING id',
      [req.session.userId, content, imageUrl]
    );
    const post = await fetchPost(req.session.userId, inserted.rows[0].id);
    notifyMentions(content, req.session.userId, post.id); // @mentions in the tweet
    emitAll('newpost', { username: req.session.username }); // live "new tweets" pill
    res.status(201).json(post);
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
    if (!Number.isInteger(postId)) return res.status(400).json({ error: 'Invalid post id.' });

    const found = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (found.rows.length === 0) return res.status(404).json({ error: 'Post not found.' });
    if (found.rows[0].user_id !== req.session.userId) {
      return res.status(403).json({ error: 'You can only delete your own tweets.' });
    }

    // Likes, comments, and retweets for this post are removed automatically
    // (ON DELETE CASCADE on each of those tables).
    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------
router.post('/:id/like', requireLogin, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) return res.status(400).json({ error: 'Invalid post id.' });

    const post = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) return res.status(404).json({ error: 'Post not found.' });

    // ON CONFLICT DO NOTHING: liking twice is harmless (UNIQUE constraint).
    await pool.query(
      'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.session.userId, postId]
    );
    notify({ userId: post.rows[0].user_id, actorId: req.session.userId, type: 'like', postId });
    res.status(201).json({ liked: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/like', requireLogin, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) return res.status(400).json({ error: 'Invalid post id.' });
    await pool.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [req.session.userId, postId]);
    res.status(200).json({ liked: false });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Retweets  (same pattern as likes — a toggle backed by a UNIQUE constraint)
// ---------------------------------------------------------------------------
router.post('/:id/retweet', requireLogin, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) return res.status(400).json({ error: 'Invalid post id.' });

    const post = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) return res.status(404).json({ error: 'Post not found.' });

    await pool.query(
      'INSERT INTO retweets (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.session.userId, postId]
    );
    notify({ userId: post.rows[0].user_id, actorId: req.session.userId, type: 'retweet', postId });
    res.status(201).json({ retweeted: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/retweet', requireLogin, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) return res.status(400).json({ error: 'Invalid post id.' });
    await pool.query('DELETE FROM retweets WHERE user_id = $1 AND post_id = $2', [req.session.userId, postId]);
    res.status(200).json({ retweeted: false });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
// GET  /api/posts/:id/comments              -> list comments (oldest first)
// POST /api/posts/:id/comments              -> add a comment
// DELETE /api/posts/:id/comments/:commentId -> delete your own comment
// ---------------------------------------------------------------------------
router.get('/:id/comments', async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) return res.status(400).json({ error: 'Invalid post id.' });

    const result = await pool.query(
      `SELECT c.id, c.content, c.created_at, u.username, u.display_name, u.avatar_url, u.avatar_anim
         FROM comments c
         JOIN users u ON u.id = c.user_id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC, c.id ASC`,
      [postId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/comments', requireLogin, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId)) return res.status(400).json({ error: 'Invalid post id.' });

    const content = (req.body.content || '').trim();
    if (content.length === 0) return res.status(400).json({ error: 'A comment cannot be empty.' });
    if (content.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ error: `A comment can be at most ${MAX_COMMENT_LENGTH} characters.` });
    }

    const post = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) return res.status(404).json({ error: 'Post not found.' });

    const inserted = await pool.query(
      'INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [postId, req.session.userId, content]
    );
    notify({ userId: post.rows[0].user_id, actorId: req.session.userId, type: 'reply', postId });
    notifyMentions(content, req.session.userId, postId); // @mentions in the reply
    // Return the same shape GET /comments uses (incl. display_name + avatar).
    const full = await pool.query(
      `SELECT c.id, c.content, c.created_at, u.username, u.display_name, u.avatar_url, u.avatar_anim
         FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = $1`,
      [inserted.rows[0].id]
    );
    res.status(201).json(full.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/comments/:commentId', requireLogin, async (req, res, next) => {
  try {
    const commentId = Number(req.params.commentId);
    if (!Number.isInteger(commentId)) return res.status(400).json({ error: 'Invalid comment id.' });

    const found = await pool.query('SELECT user_id FROM comments WHERE id = $1', [commentId]);
    if (found.rows.length === 0) return res.status(404).json({ error: 'Comment not found.' });
    if (found.rows[0].user_id !== req.session.userId) {
      return res.status(403).json({ error: 'You can only delete your own comments.' });
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
// Share the post-columns fragment so users.js renders profiles identically.
module.exports.POST_FIELDS = POST_FIELDS;
