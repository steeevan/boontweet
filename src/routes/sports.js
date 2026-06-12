// ===========================================================================
// routes/sports.js — World Cup 2026 data, proxied from football-data.org.
// ===========================================================================
// WHY a backend proxy (instead of the browser calling football-data.org)?
//   1. The API key stays secret on the server (never shipped to the browser).
//   2. We avoid browser CORS issues.
//   3. We can CACHE responses so we don't blow through the free-tier rate
//      limit (football-data.org free tier allows ~10 requests/minute).
//
// SETUP: get a free token at https://www.football-data.org/client/register
// and set it as the environment variable FOOTBALL_DATA_API_KEY. Without it,
// these endpoints reply { configured: false } and the UI shows a setup note.
// ===========================================================================

const express = require('express');

const router = express.Router();

const API_BASE = 'https://api.football-data.org/v4/competitions/WC'; // WC = FIFA World Cup
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const CACHE_MS = 60 * 1000; // cache each response for 60 seconds

// A tiny in-memory cache: { "/matches": { data, expires }, ... }
const cache = {};

// Fetch a path from football-data.org, using the cache when it's still fresh.
// Node 18+ has a built-in global fetch(), so we need no extra dependency.
async function footballDataGet(path) {
  const now = Date.now();
  if (cache[path] && cache[path].expires > now) return cache[path].data;

  const res = await fetch(API_BASE + path, { headers: { 'X-Auth-Token': API_KEY } });
  if (!res.ok) {
    throw new Error(`football-data.org responded ${res.status}`);
  }
  const data = await res.json();
  cache[path] = { data, expires: now + CACHE_MS };
  return data;
}

// Trim the big API match object down to just what the UI needs.
function trimMatch(m) {
  const ft = (m.score && m.score.fullTime) || {};
  return {
    id: m.id,
    utcDate: m.utcDate,
    status: m.status, // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED
    stage: m.stage,
    group: m.group,
    home: { name: (m.homeTeam && (m.homeTeam.shortName || m.homeTeam.name)) || 'TBD', crest: m.homeTeam && m.homeTeam.crest },
    away: { name: (m.awayTeam && (m.awayTeam.shortName || m.awayTeam.name)) || 'TBD', crest: m.awayTeam && m.awayTeam.crest },
    homeScore: ft.home === undefined ? null : ft.home,
    awayScore: ft.away === undefined ? null : ft.away,
  };
}

// ---------------------------------------------------------------------------
// GET /api/sports/matches  -> { configured, matches } or { configured:false }
// ---------------------------------------------------------------------------
router.get('/matches', async (req, res) => {
  if (!API_KEY) return res.json({ configured: false });
  try {
    const data = await footballDataGet('/matches');
    res.json({ configured: true, matches: (data.matches || []).map(trimMatch) });
  } catch (err) {
    // We answer 200 with an error message so the frontend can show it nicely.
    res.json({ configured: true, error: 'Could not load live data right now (' + err.message + ').' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/sports/standings  -> { configured, groups } or { configured:false }
// ---------------------------------------------------------------------------
router.get('/standings', async (req, res) => {
  if (!API_KEY) return res.json({ configured: false });
  try {
    const data = await footballDataGet('/standings');
    const groups = (data.standings || [])
      .filter((s) => s.type === 'TOTAL') // ignore home/away splits
      .map((s) => ({
        group: s.group,
        stage: s.stage,
        table: (s.table || []).map((r) => ({
          position: r.position,
          team: (r.team && (r.team.shortName || r.team.name)) || '?',
          crest: r.team && r.team.crest,
          played: r.playedGames,
          won: r.won,
          draw: r.draw,
          lost: r.lost,
          gd: r.goalDifference,
          points: r.points,
        })),
      }));
    res.json({ configured: true, groups });
  } catch (err) {
    res.json({ configured: true, error: 'Could not load standings right now (' + err.message + ').' });
  }
});

module.exports = router;
