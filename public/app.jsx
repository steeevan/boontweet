// ===========================================================================
// app.jsx — the entire BoonTweet frontend (React, no build step).
// ===========================================================================
// HOW TO READ THIS FILE — it's in three parts:
//   PART 1: FAKE DATA      — hardcoded tweets so the UI works with NO backend.
//   PART 2: API FUNCTIONS  — the "seam". Each one returns fake data when
//                            USE_FAKE_DATA is true, or calls the real server
//                            with fetch() when it's false.
//   PART 3: COMPONENTS     — the React UI that uses those API functions.
//
//  >>> THE BIG TEACHING MOMENT <<<
//  Flip USE_FAKE_DATA below between true and false. That single line is the
//  exact boundary between "static mockup" and "real full-stack app".
// ===========================================================================

const { useState, useEffect } = React;

// ===========================================================================
// PART 1 — FAKE DATA  (only used when USE_FAKE_DATA === true)
// ===========================================================================

// 🔁 Set to TRUE to run the whole UI with no server and no database.
//    Set to FALSE to use the real Express + Postgres backend.
const USE_FAKE_DATA = false;

// A pretend logged-in user, so the compose box shows up in fake mode.
let FAKE_USER = {
  id: 1,
  username: "demo",
  display_name: "Demo Human",
  bio: "Just here learning to build apps. 🚀",
  created_at: new Date().toISOString(),
};

// A hardcoded feed. In fake mode these are the tweets you'll see.
// (We use `let` because fake "posting" and "liking" mutate this array.)
let FAKE_TWEETS = [
  {
    id: 3,
    username: "ada",
    display_name: "Ada L.",
    content: "Just wrote my first SQL query and it actually returned the right rows. Powerful feeling.",
    image_url: null,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    like_count: 4,
    liked_by_me: false,
  },
  {
    id: 2,
    username: "grace",
    display_name: "Grace H.",
    content: "Reminder: a function that does one thing is easier to debug than one that does five.",
    image_url: "https://picsum.photos/seed/boontweet/600/320",
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    like_count: 12,
    liked_by_me: true,
  },
  {
    id: 1,
    username: "demo",
    display_name: "Demo Human",
    content: "Hello BoonTweet! 🐦 This tweet is fake data — there's no server yet.",
    image_url: null,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    like_count: 1,
    liked_by_me: false,
  },
];

// ===========================================================================
// PART 2 — API FUNCTIONS  (the seam between fake data and the live server)
// ===========================================================================

// A tiny helper that wraps fetch(): sends/receives JSON and turns any
// error response into a thrown Error carrying the server's message.
async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null; // "no content" responses have no body
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

// ---- Auth -----------------------------------------------------------------

async function apiGetCurrentUser() {
  if (USE_FAKE_DATA) return FAKE_USER; // pretend we're always logged in
  const data = await fetchJson("/api/auth/me");
  return data.user; // null when logged out
}

async function apiSignup(username, password) {
  if (USE_FAKE_DATA) return FAKE_USER;
  const data = await fetchJson("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return data.user;
}

async function apiLogin(username, password) {
  if (USE_FAKE_DATA) return FAKE_USER;
  const data = await fetchJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return data.user;
}

async function apiLogout() {
  if (USE_FAKE_DATA) return;
  await fetchJson("/api/auth/logout", { method: "POST" });
}

async function apiUpdateProfile(displayName, bio) {
  if (USE_FAKE_DATA) {
    FAKE_USER = { ...FAKE_USER, display_name: displayName, bio };
    return FAKE_USER;
  }
  const data = await fetchJson("/api/users/me", {
    method: "PUT",
    body: JSON.stringify({ display_name: displayName, bio }),
  });
  return data.user;
}

// ---- Posts / feed ---------------------------------------------------------

async function apiGetFeed() {
  if (USE_FAKE_DATA) return [...FAKE_TWEETS]; // copy so React sees a new array
  return await fetchJson("/api/posts");
}

async function apiGetProfile(username) {
  if (USE_FAKE_DATA) {
    const posts = FAKE_TWEETS.filter((t) => t.username === username);
    const user =
      username === FAKE_USER.username
        ? FAKE_USER
        : { username, display_name: posts[0] && posts[0].display_name, bio: null, created_at: FAKE_USER.created_at };
    return { user, posts };
  }
  return await fetchJson("/api/users/" + encodeURIComponent(username));
}

async function apiCreatePost(content, imageUrl) {
  if (USE_FAKE_DATA) {
    const newPost = {
      id: Date.now(),
      username: FAKE_USER.username,
      display_name: FAKE_USER.display_name,
      content,
      image_url: imageUrl || null,
      created_at: new Date().toISOString(),
      like_count: 0,
      liked_by_me: false,
    };
    FAKE_TWEETS = [newPost, ...FAKE_TWEETS]; // newest first
    return newPost;
  }
  return await fetchJson("/api/posts", {
    method: "POST",
    body: JSON.stringify({ content, image_url: imageUrl }),
  });
}

async function apiDeletePost(id) {
  if (USE_FAKE_DATA) {
    FAKE_TWEETS = FAKE_TWEETS.filter((t) => t.id !== id);
    return;
  }
  await fetchJson("/api/posts/" + id, { method: "DELETE" });
}

async function apiLike(id) {
  if (USE_FAKE_DATA) {
    FAKE_TWEETS = FAKE_TWEETS.map((t) =>
      t.id === id ? { ...t, liked_by_me: true, like_count: t.like_count + 1 } : t
    );
    return;
  }
  await fetchJson("/api/posts/" + id + "/like", { method: "POST" });
}

async function apiUnlike(id) {
  if (USE_FAKE_DATA) {
    FAKE_TWEETS = FAKE_TWEETS.map((t) =>
      t.id === id ? { ...t, liked_by_me: false, like_count: t.like_count - 1 } : t
    );
    return;
  }
  await fetchJson("/api/posts/" + id + "/like", { method: "DELETE" });
}

// ===========================================================================
// PART 3 — COMPONENTS
// ===========================================================================

// Turn an ISO timestamp into a short "5m / 3h / 2d" style label.
function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h";
  const days = Math.floor(hours / 24);
  return days + "d";
}

// The name shown in bold: the display name if set, otherwise the @username.
function shownName(user) {
  return (user && user.display_name) || (user && user.username) || "?";
}

// ---- Avatar ---------------------------------------------------------------
// No uploaded pictures: we build a colorful gradient circle from the username.
// The same username always produces the same colors (a simple string hash),
// so each person gets a consistent, unique avatar — for free, no storage.
function avatarGradient(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${hue1} 85% 60%), hsl(${hue2} 85% 50%))`;
}

function Avatar({ name, size = 44, onClick }) {
  const label = name || "?";
  return (
    <div
      className={"avatar" + (onClick ? " clickable" : "")}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: avatarGradient(label),
      }}
    >
      {label.charAt(0).toUpperCase()}
    </div>
  );
}

// ---- AuthForm: shown when nobody is logged in ----------------------------
function AuthForm({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); // stop the browser's default form submit (page reload)
    setError("");
    setBusy(true);
    try {
      const user =
        mode === "login"
          ? await apiLogin(username, password)
          : await apiSignup(username, password);
      onAuthed(user); // tell <App> who logged in
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="auth-tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
          Log in
        </button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          className="field"
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <input
          className="field"
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        {error && <div className="error">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>
          {mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </div>
  );
}

// ---- Composer: the box for writing a new tweet ---------------------------
function Composer({ currentUser, onPosted }) {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showImage, setShowImage] = useState(false);
  const [error, setError] = useState("");
  const MAX = 280;

  const remaining = MAX - content.length;
  const isEmpty = content.trim().length === 0;
  const tooLong = content.length > MAX;

  async function handlePost() {
    setError("");
    try {
      await apiCreatePost(content, imageUrl.trim() || null);
      setContent("");
      setImageUrl("");
      setShowImage(false);
      onPosted(); // ask <App> to reload the feed
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card composer">
      <div className="row">
        <Avatar name={currentUser.username} />
        <div className="row-main">
          <textarea
            placeholder="What's happening?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={MAX + 20} /* allow a little overflow so the counter can go red */
          />

          {/* The image-URL field only appears once you click the 🖼️ button. */}
          {showImage && (
            <input
              className="image-input"
              placeholder="Paste an image URL (https://...)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          )}
          {/* Live preview of the pasted image. onError hides a broken link. */}
          {showImage && imageUrl.trim() && (
            <img
              className="image-preview"
              src={imageUrl}
              alt="preview"
              onError={(e) => (e.target.style.display = "none")}
              onLoad={(e) => (e.target.style.display = "block")}
            />
          )}

          {error && <div className="error">{error}</div>}

          <div className="composer-footer">
            <button
              className="icon-btn"
              title="Add an image by URL"
              onClick={() => setShowImage((s) => !s)}
            >
              🖼️
            </button>
            <span className="spacer"></span>
            <span className={"char-count" + (tooLong ? " over" : "")}>{remaining}</span>
            <button className="btn" onClick={handlePost} disabled={isEmpty || tooLong}>
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Tweet: a single post, with avatar, optional image, like + delete ----
function Tweet({ tweet, currentUser, onChanged, onOpenProfile }) {
  // You can delete a tweet only if it's yours.
  const isMine = currentUser && currentUser.username === tweet.username;

  async function toggleLike() {
    try {
      if (tweet.liked_by_me) {
        await apiUnlike(tweet.id);
      } else {
        await apiLike(tweet.id);
      }
      onChanged(); // reload the feed so counts are accurate
    } catch (err) {
      alert(err.message); // e.g. "You must be logged in to do that."
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this tweet?")) return;
    try {
      await apiDeletePost(tweet.id);
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <Avatar name={tweet.username} onClick={() => onOpenProfile(tweet.username)} />
        <div className="row-main">
          <div className="tweet-head">
            <span className="tweet-name" onClick={() => onOpenProfile(tweet.username)}>
              {shownName(tweet)}
            </span>
            <span className="tweet-handle" onClick={() => onOpenProfile(tweet.username)}>
              @{tweet.username}
            </span>
            <span className="tweet-time">· {timeAgo(tweet.created_at)}</span>
            <span className="spacer"></span>
            {isMine && (
              <button className="delete-btn" title="Delete" onClick={handleDelete}>
                ×
              </button>
            )}
          </div>

          <div className="tweet-content">{tweet.content}</div>

          {tweet.image_url && (
            <img
              className="tweet-image"
              src={tweet.image_url}
              alt=""
              onError={(e) => (e.target.style.display = "none")}
            />
          )}

          <div className="tweet-actions">
            <button
              className={"like-btn" + (tweet.liked_by_me ? " liked" : "")}
              onClick={toggleLike}
            >
              {tweet.liked_by_me ? "♥" : "♡"} {tweet.like_count}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Feed: a list of tweets ----------------------------------------------
function Feed({ tweets, currentUser, onChanged, onOpenProfile }) {
  if (tweets.length === 0) {
    return <div className="empty">No tweets yet. Be the first!</div>;
  }
  return (
    <div>
      {tweets.map((tweet) => (
        <Tweet
          key={tweet.id}
          tweet={tweet}
          currentUser={currentUser}
          onChanged={onChanged}
          onOpenProfile={onOpenProfile}
        />
      ))}
    </div>
  );
}

// ---- Profile: one user's info + their tweets -----------------------------
function Profile({ username, currentUser, onChanged, onOpenProfile, onEdit }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // Load this profile whenever the username changes.
  useEffect(() => {
    setData(null);
    apiGetProfile(username).then(setData).catch((err) => setError(err.message));
  }, [username]);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="empty">Loading…</div>;

  const isOwnProfile = currentUser && currentUser.username === data.user.username;

  return (
    <div>
      <div className="profile-banner"></div>
      <div className="card profile-card">
        <div className="profile-top">
          <div className="profile-avatar-ring">
            <Avatar name={data.user.username} size={92} />
          </div>
          {isOwnProfile && (
            <button className="btn-ghost" onClick={onEdit}>
              Edit profile
            </button>
          )}
        </div>

        <h2 className="profile-name">{shownName(data.user)}</h2>
        <div className="profile-handle">@{data.user.username}</div>
        {data.user.bio && <p className="profile-bio">{data.user.bio}</p>}
        <div className="profile-meta">
          Joined {new Date(data.user.created_at).toLocaleDateString()} ·{" "}
          {data.posts.length} tweet{data.posts.length === 1 ? "" : "s"}
        </div>
      </div>

      <Feed
        tweets={data.posts}
        currentUser={currentUser}
        onChanged={onChanged}
        onOpenProfile={onOpenProfile}
      />
    </div>
  );
}

// ---- Settings: edit your display name + bio ------------------------------
function Settings({ currentUser, onSaved }) {
  const [displayName, setDisplayName] = useState(currentUser.display_name || "");
  const [bio, setBio] = useState(currentUser.bio || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      const updated = await apiUpdateProfile(displayName.trim(), bio.trim());
      onSaved(updated); // update <App>'s copy of the current user
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2 className="page-title">Settings</h2>
      <form className="card" onSubmit={handleSave}>
        <label className="field-label">Display name</label>
        <input
          className="field"
          placeholder="e.g. Ada Lovelace"
          value={displayName}
          maxLength={50}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <label className="field-label">Bio</label>
        <textarea
          className="field"
          placeholder="A short something about you…"
          value={bio}
          maxLength={160}
          onChange={(e) => setBio(e.target.value)}
        />

        {error && <div className="error">{error}</div>}
        {saved && <div className="success">Saved! ✨</div>}

        <button className="btn" type="submit">
          Save changes
        </button>
      </form>
    </div>
  );
}

// ---- App: the top-level component that ties everything together ----------
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);

  // `view` is our tiny home-grown router: feed, a profile page, or settings.
  const [view, setView] = useState({ name: "feed" });

  // Reload the feed from the API (used after posting / liking / deleting).
  async function reloadFeed() {
    const data = await apiGetFeed();
    setTweets(data);
  }

  // On first load: find out who's logged in, then load the feed.
  useEffect(() => {
    async function start() {
      try {
        const user = await apiGetCurrentUser();
        setCurrentUser(user);
        await reloadFeed();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    start();
  }, []);

  function handleChanged() {
    reloadFeed();
  }

  function openProfile(username) {
    setView({ name: "profile", username });
  }

  function goHome() {
    setView({ name: "feed" });
    reloadFeed();
  }

  async function handleLogout() {
    await apiLogout();
    setCurrentUser(null);
    setView({ name: "feed" });
    reloadFeed(); // refresh so like/delete buttons update for logged-out state
  }

  // Called by Settings after a successful save.
  function handleProfileSaved(updatedUser) {
    setCurrentUser(updatedUser);
    reloadFeed(); // so the new display name shows on this user's tweets
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo" onClick={goHome}>
          ✦ BoonTweet
        </div>
        <div className="header-nav">
          {currentUser ? (
            <>
              <button className="icon-btn" title="Settings" onClick={() => setView({ name: "settings" })}>
                ⚙
              </button>
              <Avatar
                name={currentUser.username}
                size={36}
                onClick={() => openProfile(currentUser.username)}
              />
              <button className="btn-ghost" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <span className="muted">Log in to post</span>
          )}
        </div>
      </header>

      {/* Logged-out users see the login/signup form. Logged-in users see the
          compose box. Everyone can read the feed / profiles below. */}
      {currentUser ? (
        <Composer currentUser={currentUser} onPosted={reloadFeed} />
      ) : (
        <AuthForm
          onAuthed={(user) => {
            setCurrentUser(user);
            reloadFeed();
          }}
        />
      )}

      {loading ? (
        <div className="empty">Loading…</div>
      ) : view.name === "settings" ? (
        <Settings currentUser={currentUser} onSaved={handleProfileSaved} />
      ) : view.name === "profile" ? (
        <Profile
          username={view.username}
          currentUser={currentUser}
          onChanged={handleChanged}
          onOpenProfile={openProfile}
          onEdit={() => setView({ name: "settings" })}
        />
      ) : (
        <Feed
          tweets={tweets}
          currentUser={currentUser}
          onChanged={handleChanged}
          onOpenProfile={openProfile}
        />
      )}
    </div>
  );
}

// Hand the <App> component to React and tell it to draw into <div id="root">.
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
