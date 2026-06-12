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
  -- Appearance / customization (all optional):
  avatar_url    TEXT,                          -- uploaded profile photo (else a generated avatar is used)
  banner_url    TEXT,                          -- uploaded profile banner
  theme         VARCHAR(20) DEFAULT 'neon',    -- site color theme the user prefers
  avatar_anim   VARCHAR(20),                   -- animated avatar "mascot" choice
  page_effect   VARCHAR(20),                   -- ambient background animation
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
-- comments — one row per reply to a post.
-- ---------------------------------------------------------------------------
-- Like posts, comments belong to a user and (here) to a post. Deleting a post
-- removes its comments automatically (ON DELETE CASCADE).
CREATE TABLE IF NOT EXISTS comments (
  id         SERIAL  PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    VARCHAR(280) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments (post_id);


-- ---------------------------------------------------------------------------
-- retweets — one row per (user re-shared post) relationship.
-- ---------------------------------------------------------------------------
-- Same shape and idea as "likes": UNIQUE(user_id, post_id) means you can't
-- retweet the same post twice. A retweet makes the post show up in the
-- retweeter's feed/profile with a "retweeted by" label.
CREATE TABLE IF NOT EXISTS retweets (
  id         SERIAL  PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_retweets_post_id ON retweets (post_id);


-- ---------------------------------------------------------------------------
-- media — uploaded images, stored directly in the database.
-- ---------------------------------------------------------------------------
-- We keep the raw image bytes in a BYTEA column and serve them back at
-- /api/media/:id. This needs no external storage service, which keeps the app
-- self-contained and deploy-friendly. (Trade-off: it isn't how you'd store
-- large amounts of media at real scale — you'd use object storage like S3 —
-- but it's perfect for a class-sized app.)
CREATE TABLE IF NOT EXISTS media (
  id         SERIAL  PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime_type  TEXT    NOT NULL,           -- e.g. image/png, image/jpeg
  bytes      BYTEA   NOT NULL,           -- the actual file contents
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


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
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme        VARCHAR(20) DEFAULT 'neon';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_anim  VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS page_effect  VARCHAR(20);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url    TEXT;
