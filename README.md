# 🐦 BoonTweet

A minimal Twitter clone built for learning full-stack web development.

**Stack:** React (loaded from a CDN, no build step) · Node.js + Express · PostgreSQL

A social app with accounts, a feed, likes, replies, retweets, profiles, image
uploads, **8 switchable themes**, and a **live World Cup 2026** tab. It runs
from a **single server**.

### Features

- 🔐 **Accounts** — sign up, log in, log out (passwords hashed with bcrypt).
- 📝 **Tweets** — post up to 280 chars, with an optional image (upload a file or paste a URL).
- ❤️ **Likes**, 💬 **Replies**, and 🔁 **Retweets** — retweets show in the feed with a "retweeted by" label.
- 🧭 **Layout** — sidebar or top-tabs navigation; Feed and a Sports tab.
- ⚽ **World Cup 2026** — live fixtures, scores, and standings (via football-data.org).
- 👤 **Profiles** — avatar, banner, display name, bio, and the user's tweets + retweets.
- 🖼️ **Image uploads** — stored in PostgreSQL and served back from the app.
- 🎨 **8 themes + live Appearance panel** — Dark Neon, Clean Light, Y2K Pop, Brutalist,
  Terminal, Glass, Editorial, Cozy Pastel. The floating 🎨 panel switches **theme,
  accent, font, navigation, card style, and density** instantly; your theme is saved
  to your account, the other tweaks to your browser.
- 🪄 **Avatars** — your uploaded photo, otherwise an auto-generated gradient initial.

---

## What's in here

```
public/          → the frontend (served as static files by the server)
  index.html     → loads React from a CDN
  style.css      → hand-written styles, no framework
  app.jsx        → the React app (fake data first, then real fetch calls)
src/
  server.js      → the Express app + server start (auto-loads schema on boot)
  db.js          → the one shared Postgres connection pool
  routes/
    auth.js      → signup / login / logout / me
    posts.js     → feed, tweets, likes, retweets, comments
    users.js     → public profiles + editing your own profile/appearance
    media.js     → image upload + serving (stored in Postgres)
    sports.js    → World Cup 2026 data, proxied from football-data.org
schema.sql       → the database tables
.env.example     → the environment variables you need
```

### The teaching seam (fake data → real server)

Open `public/app.jsx`. At the very top is one line:

```js
const USE_FAKE_DATA = false;
```

- **`true`**  → the app runs entirely on a hardcoded array of fake tweets.
  **No server or database needed.** Just open the page.
- **`false`** → every API function calls the real backend with `fetch()`.

Flipping that single line is the exact moment a static mockup becomes a real
full-stack app. Great for a live demo.

---

## Run it locally

You'll always need **Node.js 18+**. For the database you have two options —
**Option A uses Docker and is the easiest** (you don't install PostgreSQL at all).

### Option A — Docker for the database (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
npm install            # install app dependencies (once)
docker compose up -d   # start PostgreSQL in a container (auto-loads schema.sql)
npm start              # run the app
```

That's it — open **http://localhost:3000**, sign up, and start tweeting!

The default `DATABASE_URL` in the code already matches this container, so no
`.env` file is needed for local development. Useful commands:

```bash
docker compose down     # stop the database (your data is KEPT)
docker compose down -v  # stop AND wipe the data (start completely fresh)
```

> You don't need to load the schema by hand: the server runs `schema.sql`
> itself on startup (safely, since every statement is `IF NOT EXISTS`), so the
> tables are created automatically the first time you `npm start`.

### Option B — your own local PostgreSQL install

If you'd rather install PostgreSQL directly:

```bash
npm install
createdb boontweet                 # or: psql -c "CREATE DATABASE boontweet;"
cp .env.example .env               # then edit DATABASE_URL to match your setup
npm start                          # the tables are created automatically on startup
```

In `.env`, set `DATABASE_URL` to point at your database (host, port, user,
password) and set a real `SESSION_SECRET`. You can generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then open **http://localhost:3000**.

---

## How the pieces fit together

1. The browser loads `index.html`, which pulls React from a CDN and runs `app.jsx`.
2. `app.jsx` calls the API (e.g. `GET /api/posts`) using `fetch()`.
3. Express (`server.js`) routes that request to a handler in `src/routes/`.
4. The handler runs a **parameterized** SQL query through the shared pool in `db.js`.
5. PostgreSQL returns rows; the handler sends them back as JSON; React renders them.

### Why parameterized queries everywhere?

Every query uses placeholders (`$1`, `$2`, …) instead of building SQL strings
by hand. The database treats those values as **data, never as code**, so
SQL-injection attacks don't work. This is the safe default we want to teach.

---

## API reference

| Method & path                | What it does                          | Auth required |
| ---------------------------- | ------------------------------------- | ------------- |
| `POST /api/auth/signup`      | Create an account, log in             | no            |
| `POST /api/auth/login`       | Log in                                | no            |
| `POST /api/auth/logout`      | Log out                               | no            |
| `GET  /api/auth/me`          | Who am I? (`{ user }` or `null`)      | no            |
| `GET  /api/posts`            | Feed (tweets + retweets), newest first | no           |
| `POST /api/posts`            | Create a tweet (1–280 chars, optional `image_url`) | **yes** |
| `DELETE /api/posts/:id`      | Delete your own tweet                 | **yes**       |
| `POST/DELETE /api/posts/:id/like`    | Like / unlike a tweet         | **yes**       |
| `POST/DELETE /api/posts/:id/retweet` | Retweet / un-retweet          | **yes**       |
| `GET  /api/posts/:id/comments`       | List replies                  | no            |
| `POST /api/posts/:id/comments`       | Add a reply                   | **yes**       |
| `DELETE /api/posts/:id/comments/:cid`| Delete your own reply         | **yes**       |
| `GET  /api/users/:username`  | A profile + that user's tweets/retweets | no          |
| `PUT  /api/users/me`         | Edit profile + appearance             | **yes**       |
| `POST /api/media`            | Upload an image (form field `image`)  | **yes**       |
| `GET  /api/media/:id`        | Serve a stored image                  | no            |
| `GET  /api/sports/matches`   | World Cup matches/scores              | no            |
| `GET  /api/sports/standings` | World Cup group standings             | no            |

Each tweet returned by the feed/profile includes `username`, `display_name`,
`avatar_url`, `avatar_anim`, `image_url`, `like_count`, `comment_count`,
`retweet_count`, `liked_by_me`, `retweeted_by_me`, and `retweeted_by`.

### Data model

`users` (now incl. `display_name`, `bio`, `avatar_url`, `banner_url`, `theme`,
`avatar_anim`, `page_effect`) · `posts` (incl. `image_url`) · `likes` ·
`comments` · `retweets` · `media` (uploaded image bytes) · `session`.

---

## Deploy to Render

Render can host both the Node server and the Postgres database for free.

### 1. Create the database

1. In the Render dashboard, click **New → PostgreSQL**.
2. Give it a name and pick a **region** — remember which one.
3. Click **Create Database** and wait for it to finish provisioning.
4. On the database page, copy the **Internal Database URL**.

### 2. Create the web service

1. Push this project to a GitHub repository.
2. In Render, click **New → Web Service** and connect that repo.
3. **Use the SAME region you picked for the database** (so the app and DB can
   talk over the fast internal network).
4. Set the commands:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

### 3. Set environment variables

On the web service's **Environment** tab, add:

| Key                     | Value                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`          | the **Internal Database URL** you copied above             |
| `SESSION_SECRET`        | a long random string (generate one as shown above)         |
| `FOOTBALL_DATA_API_KEY` | *(optional)* free token from football-data.org for the Sports tab |

> You do **not** need to set `PORT` — Render provides it automatically, and
> the app already reads it from the environment. Without
> `FOOTBALL_DATA_API_KEY`, the Sports tab simply shows a "add your key" note.

### 4. Deploy & open your app

That's it — there's **no manual schema step**. On startup the server runs
`schema.sql` itself (every statement is `IF NOT EXISTS`, so it's safe), which
creates the tables on the first boot against the empty database.

Render builds and deploys automatically, then gives you a public URL like
`https://boontweet.onrender.com`. Visit it, sign up, and you're live. 🎉

> Every future `git push` to `main` triggers an automatic redeploy.

---

## Common problems

- **Login doesn't stick / "could not connect" on Render** → check `DATABASE_URL` is set to the **Internal** URL and the app + DB are in the same region.
- **First request is slow** → on Render's free tier the app "sleeps" after inactivity and takes ~30s to wake. That's normal.
- **Page is blank** → open the browser's developer console (F12) for errors. In fake mode, make sure you opened the page through `http://localhost:3000`, not by double-clicking the file (Babel needs `http`).
