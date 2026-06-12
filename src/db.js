// ===========================================================================
// db.js — the ONE shared connection to PostgreSQL.
// ===========================================================================
// Every part of the app that talks to the database imports this same `pool`.
// A "pool" keeps a small set of reusable connections open so we don't pay the
// cost of opening a new one on every request. Create it ONCE, share it.
// ===========================================================================

const { Pool } = require('pg');

// Load variables from a local .env file (if present) into process.env.
// On Render the env vars are provided by the platform, so .env isn't needed.
require('dotenv').config();

// Read the connection string from the environment, with a sensible LOCAL
// default that matches the database in docker-compose.yml. So after running
// "docker compose up -d", a plain "npm start" connects with no extra config.
const connectionString =
  process.env.DATABASE_URL ||
  'postgres://boontweet:boontweet@localhost:5433/boontweet';

// Managed databases (like Render's) require an encrypted SSL connection;
// a local Postgres on your own machine does not. Simple rule of thumb:
// turn SSL on for any host that isn't "localhost".
const isLocal = connectionString.includes('localhost');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

// Export the single pool so other files can run queries:
//   const pool = require('./db');
//   const result = await pool.query('SELECT ...', [params]);
module.exports = pool;
