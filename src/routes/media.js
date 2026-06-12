// ===========================================================================
// routes/media.js — upload images and serve them back.
// ===========================================================================
// Uploaded images are stored as raw bytes in the "media" table (see
// schema.sql) and served at /api/media/:id. No external storage service
// needed. We use "multer" to parse the uploaded file from the request.
// ===========================================================================

const express = require('express');
const multer = require('multer');
const pool = require('../db');
const { requireLogin } = require('./auth');

const router = express.Router();

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

// Keep the uploaded file in memory (as a Buffer) so we can write it straight
// into the database. Reject anything that isn't an image.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
});

// Run multer but turn its errors (too big, wrong type) into clean 400s
// instead of crashing into the generic 500 handler.
function uploadSingle(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 2 MB).' : err.message;
      return res.status(400).json({ error: msg || 'Upload failed.' });
    }
    next();
  });
}

// ---------------------------------------------------------------------------
// POST /api/media  -> upload one image (form field name: "image").
// Returns { url: "/api/media/123" } to use as a tweet image / avatar / banner.
// ---------------------------------------------------------------------------
router.post('/', requireLogin, uploadSingle, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided.' });

    const result = await pool.query(
      'INSERT INTO media (user_id, mime_type, bytes) VALUES ($1, $2, $3) RETURNING id',
      [req.session.userId, req.file.mimetype, req.file.buffer]
    );
    res.status(201).json({ url: '/api/media/' + result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/media/:id  -> serve the stored image bytes. Public.
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid media id.' });

    const result = await pool.query('SELECT mime_type, bytes FROM media WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Image not found.' });

    const { mime_type, bytes } = result.rows[0];
    res.set('Content-Type', mime_type);
    res.set('Cache-Control', 'public, max-age=31536000, immutable'); // images never change
    res.send(bytes); // bytes is a Node Buffer; Express sends it as binary
  } catch (err) {
    next(err);
  }
});

module.exports = router;
