-- ===========================================================================
-- BoonTweet — database schema
-- ===========================================================================
-- Run this file ONCE against your database to create all the tables:
--
--     psql "$DATABASE_URL" -f schema.sql
--
-- Everything here is safe to re-run: we use "CREATE TABLE IF NOT EXISTS" and
-- "ADD COLUMN IF NOT EXISTS", so running it twice won't crash.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- users — one row per account.
-- ---------------------------------------------------------------------------
-- WHY password_hash (and not "password")? We NEVER store the real password.
-- We store a one-way bcrypt hash of it. Even if the database leaks, the
-- original passwords stay secret. (Hashing happens in src/routes/auth.js.)
--
-- display_name and bio are OPTIONAL profile fields the user can edit later
-- on the Settings page.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(30)  NOT NULL UNIQUE,  -- UNIQUE => no two accounts share a name
  password_hash TEXT         NOT NULL,
  display_name  VARCHAR(50),                   -- friendly name shown above @username
  bio           VARCHAR(160),                  -- short "about me" on the profile page
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- posts — one row per tweet.
-- ---------------------------------------------------------------------------
-- user_id is a FOREIGN KEY into users: every post must belong to a real user.
-- ON DELETE CASCADE => if a user is deleted, their posts are deleted too.
-- image_url is OPTIONAL: a link to an image to show with the tweet.
CREATE TABLE IF NOT EXISTS posts (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    VARCHAR(280) NOT NULL,            -- DB-level guard; we also validate in the API
  image_url  TEXT,                             -- optional link to an image
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- likes — one row per (user likes post) relationship.
-- ---------------------------------------------------------------------------
-- The UNIQUE(user_id, post_id) constraint is the key idea here: it makes it
-- IMPOSSIBLE for the same user to like the same post twice. The database
-- enforces this for us, so we don't have to write fragile checking code.
CREATE TABLE IF NOT EXISTS likes (
  id      SERIAL  PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  UNIQUE (user_id, post_id)
);

-- A helpful index: we frequently count likes for a given post.
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes (post_id);


-- ---------------------------------------------------------------------------
-- session — where logins are stored (managed by the "connect-pg-simple" lib).
-- ---------------------------------------------------------------------------
-- WHY store sessions in Postgres? A logged-in user's session would normally
-- live in the server's memory and vanish every time the server restarts.
-- Storing it in the database keeps people logged in across restarts.
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    VARCHAR      NOT NULL PRIMARY KEY,
  "sess"   JSON         NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");


-- ---------------------------------------------------------------------------
-- Migrations for EXISTING databases.
-- ---------------------------------------------------------------------------
-- If you created your database with an OLDER version of this file (before
-- profiles/images existed), these lines safely add the new columns. They do
-- nothing if the columns are already there — so this whole file stays
-- re-runnable. This is a tiny taste of how real "schema migrations" work.
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio          VARCHAR(160);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url    TEXT;
