// ===========================================================================
// routes/notifications.js — your bell: likes, replies, follows, retweets,
// and @mentions. Other routes call notify(...) to create these.
// ===========================================================================

const express = require('express');
const pool = require('../db');
const { requireLogin } = require('./auth');

const router = express.Router();

// Create a notification. Never notifies you about your own action, and never
// throws into the caller — a failed notification must not break the action
// that triggered it (the like/follow/etc. should still succeed).
async function notify({ userId, actorId, type, postId = null }) {
  if (!userId || userId === actorId) return;
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES ($1, $2, $3, $4)',
      [userId, actorId, type, postId]
    );
  } catch (err) {
    console.error('notify failed:', err.message);
  }
}

// Notify everyone @mentioned in a piece of text (deduped, excludes the author).
async function notifyMentions(text, actorId, postId) {
  const handles = [...new Set((String(text).match(/@(\w{1,30})/g) || []).map((h) => h.slice(1)))];
  if (!handles.length) return;
  try {
    const rows = await pool.query('SELECT id FROM users WHERE username = ANY($1)', [handles]);
    for (const r of rows.rows) await notify({ userId: r.id, actorId, type: 'mention', postId });
  } catch (err) {
    console.error('notifyMentions failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// GET /api/notifications  -> recent notifications for the logged-in user.
// ---------------------------------------------------------------------------
router.get('/', requireLogin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT n.id, n.type, n.read, n.created_at, n.post_id,
              u.username AS actor_username, u.display_name AS actor_display_name, u.avatar_url AS actor_avatar_url,
              LEFT(p.content, 90) AS post_snippet
         FROM notifications n
         JOIN users u ON u.id = n.actor_id
         LEFT JOIN posts p ON p.id = n.post_id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT 40`,
      [req.session.userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/notifications/unread-count  -> { count } for the bell badge.
// ---------------------------------------------------------------------------
router.get('/unread-count', requireLogin, async (req, res, next) => {
  try {
    const r = await pool.query('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read = false', [req.session.userId]);
    res.json({ count: r.rows[0].count });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/notifications/read  -> mark all as read (clears the badge).
// ---------------------------------------------------------------------------
router.post('/read', requireLogin, async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [req.session.userId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.notify = notify;
module.exports.notifyMentions = notifyMentions;
