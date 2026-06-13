// ===========================================================================
// routes/stream.js — GET /api/stream : a Server-Sent-Events connection.
// ===========================================================================
// The browser opens this once (EventSource) and the server keeps it open,
// pushing "notification" and "newpost" events as they happen. A heartbeat
// every 25s keeps proxies from closing the idle connection.
// ===========================================================================

const express = require('express');
const { addClient, removeClient } = require('../events');

const router = express.Router();

router.get('/', (req, res) => {
  if (!req.session.userId) return res.status(401).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering so events flush immediately
  });
  res.write('retry: 5000\n\n'); // if the connection drops, the browser retries after 5s

  const userId = req.session.userId;
  addClient(userId, res);

  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 25000);

  req.on('close', () => { clearInterval(heartbeat); removeClient(userId, res); });
});

module.exports = router;
