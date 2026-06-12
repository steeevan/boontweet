// ===========================================================================
// app.jsx — the entire BoonTweet frontend (React, no build step).
// ===========================================================================
// THREE PARTS:
//   PART 1: FAKE DATA      — hardcoded data so the UI works with NO backend.
//   PART 2: API FUNCTIONS  — the "seam": fake data when USE_FAKE_DATA is true,
//                            real fetch() calls when it's false.
//   PART 3: COMPONENTS      — the React UI.
//
//  Flip USE_FAKE_DATA to switch between a static mockup and the live app.
// ===========================================================================

const { useState, useEffect } = React;

// ===========================================================================
// PART 1 — FAKE DATA  (only used when USE_FAKE_DATA === true)
// ===========================================================================

const USE_FAKE_DATA = false; // 🔁 true = no backend needed; false = live server

let FAKE_USER = {
  id: 1,
  username: "demo",
  display_name: "Demo Human",
  bio: "Just here learning to build apps. 🚀",
  created_at: new Date().toISOString(),
};

// Each tweet now also carries comment/retweet counts and a retweeted_by label.
let FAKE_TWEETS = [
  {
    id: 3, username: "ada", display_name: "Ada L.",
    content: "Just wrote my first SQL query and it returned the right rows. Powerful feeling.",
    image_url: null, created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    like_count: 4, comment_count: 1, retweet_count: 0,
    liked_by_me: false, retweeted_by_me: false, retweeted_by: null,
  },
  {
    id: 2, username: "grace", display_name: "Grace H.",
    content: "A function that does one thing is easier to debug than one that does five.",
    image_url: "https://picsum.photos/seed/boontweet/600/320",
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    like_count: 12, comment_count: 2, retweet_count: 3,
    liked_by_me: true, retweeted_by_me: false, retweeted_by: null,
  },
  {
    id: 1, username: "demo", display_name: "Demo Human",
    content: "Hello BoonTweet! 🐦 This tweet is fake data — there's no server yet.",
    image_url: null, created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    like_count: 1, comment_count: 0, retweet_count: 0,
    liked_by_me: false, retweeted_by_me: false, retweeted_by: null,
  },
];

// Fake comments, keyed by post id.
let FAKE_COMMENTS = {
  3: [{ id: 1, username: "grace", display_name: "Grace H.", content: "Welcome to the club! 🎉", created_at: new Date().toISOString() }],
  2: [
    { id: 2, username: "ada", display_name: "Ada L.", content: "100%.", created_at: new Date().toISOString() },
    { id: 3, username: "demo", display_name: "Demo Human", content: "Saving this.", created_at: new Date().toISOString() },
  ],
};

// ===========================================================================
// PART 2 — API FUNCTIONS  (the seam between fake data and the live server)
// ===========================================================================

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

// ---- Auth ----
async function apiGetCurrentUser() {
  if (USE_FAKE_DATA) return FAKE_USER;
  const data = await fetchJson("/api/auth/me");
  return data.user;
}
async function apiSignup(username, password) {
  if (USE_FAKE_DATA) return FAKE_USER;
  return (await fetchJson("/api/auth/signup", { method: "POST", body: JSON.stringify({ username, password }) })).user;
}
async function apiLogin(username, password) {
  if (USE_FAKE_DATA) return FAKE_USER;
  return (await fetchJson("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) })).user;
}
async function apiLogout() {
  if (USE_FAKE_DATA) return;
  await fetchJson("/api/auth/logout", { method: "POST" });
}
async function apiUpdateProfile(displayName, bio) {
  if (USE_FAKE_DATA) { FAKE_USER = { ...FAKE_USER, display_name: displayName, bio }; return FAKE_USER; }
  return (await fetchJson("/api/users/me", { method: "PUT", body: JSON.stringify({ display_name: displayName, bio }) })).user;
}

// ---- Posts / feed ----
async function apiGetFeed() {
  if (USE_FAKE_DATA) return [...FAKE_TWEETS];
  return await fetchJson("/api/posts");
}
async function apiGetProfile(username) {
  if (USE_FAKE_DATA) {
    const posts = FAKE_TWEETS.filter((t) => t.username === username);
    const user = username === FAKE_USER.username ? FAKE_USER
      : { username, display_name: posts[0] && posts[0].display_name, bio: null, created_at: FAKE_USER.created_at };
    return { user, posts };
  }
  return await fetchJson("/api/users/" + encodeURIComponent(username));
}
async function apiCreatePost(content, imageUrl) {
  if (USE_FAKE_DATA) {
    const newPost = {
      id: Date.now(), username: FAKE_USER.username, display_name: FAKE_USER.display_name,
      content, image_url: imageUrl || null, created_at: new Date().toISOString(),
      like_count: 0, comment_count: 0, retweet_count: 0,
      liked_by_me: false, retweeted_by_me: false, retweeted_by: null,
    };
    FAKE_TWEETS = [newPost, ...FAKE_TWEETS];
    return newPost;
  }
  return await fetchJson("/api/posts", { method: "POST", body: JSON.stringify({ content, image_url: imageUrl }) });
}
async function apiDeletePost(id) {
  if (USE_FAKE_DATA) { FAKE_TWEETS = FAKE_TWEETS.filter((t) => t.id !== id); return; }
  await fetchJson("/api/posts/" + id, { method: "DELETE" });
}

// ---- Likes ----
async function apiLike(id) {
  if (USE_FAKE_DATA) { toggleFake(id, "liked_by_me", "like_count", true); return; }
  await fetchJson("/api/posts/" + id + "/like", { method: "POST" });
}
async function apiUnlike(id) {
  if (USE_FAKE_DATA) { toggleFake(id, "liked_by_me", "like_count", false); return; }
  await fetchJson("/api/posts/" + id + "/like", { method: "DELETE" });
}

// ---- Retweets ----
async function apiRetweet(id) {
  if (USE_FAKE_DATA) { toggleFake(id, "retweeted_by_me", "retweet_count", true); return; }
  await fetchJson("/api/posts/" + id + "/retweet", { method: "POST" });
}
async function apiUnretweet(id) {
  if (USE_FAKE_DATA) { toggleFake(id, "retweeted_by_me", "retweet_count", false); return; }
  await fetchJson("/api/posts/" + id + "/retweet", { method: "DELETE" });
}

// Small helper for fake like/retweet toggles.
function toggleFake(id, flagKey, countKey, on) {
  FAKE_TWEETS = FAKE_TWEETS.map((t) =>
    t.id === id ? { ...t, [flagKey]: on, [countKey]: t[countKey] + (on ? 1 : -1) } : t
  );
}

// ---- Comments ----
async function apiGetComments(postId) {
  if (USE_FAKE_DATA) return [...(FAKE_COMMENTS[postId] || [])];
  return await fetchJson("/api/posts/" + postId + "/comments");
}
async function apiAddComment(postId, content) {
  if (USE_FAKE_DATA) {
    const c = { id: Date.now(), username: FAKE_USER.username, display_name: FAKE_USER.display_name, content, created_at: new Date().toISOString() };
    FAKE_COMMENTS[postId] = [...(FAKE_COMMENTS[postId] || []), c];
    toggleFake(postId, "comment_count", "comment_count", true); // bump count (flag unused)
    FAKE_TWEETS = FAKE_TWEETS.map((t) => (t.id === postId ? { ...t, comment_count: (FAKE_COMMENTS[postId] || []).length } : t));
    return c;
  }
  return await fetchJson("/api/posts/" + postId + "/comments", { method: "POST", body: JSON.stringify({ content }) });
}
async function apiDeleteComment(postId, commentId) {
  if (USE_FAKE_DATA) {
    FAKE_COMMENTS[postId] = (FAKE_COMMENTS[postId] || []).filter((c) => c.id !== commentId);
    FAKE_TWEETS = FAKE_TWEETS.map((t) => (t.id === postId ? { ...t, comment_count: (FAKE_COMMENTS[postId] || []).length } : t));
    return;
  }
  await fetchJson("/api/posts/" + postId + "/comments/" + commentId, { method: "DELETE" });
}

// ===========================================================================
// PART 3 — COMPONENTS
// ===========================================================================

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
}

function shownName(user) {
  return (user && user.display_name) || (user && user.username) || "?";
}

// ---- Avatar (gradient circle from username) ----
function avatarGradient(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${h1} 85% 60%), hsl(${(h1 + 60) % 360} 85% 50%))`;
}
function Avatar({ name, size = 44, onClick }) {
  const label = name || "?";
  return (
    <div className={"avatar" + (onClick ? " clickable" : "")} onClick={onClick}
      style={{ width: size, height: size, fontSize: size * 0.42, background: avatarGradient(label) }}>
      {label.charAt(0).toUpperCase()}
    </div>
  );
}

// ---- AuthForm ----
function AuthForm({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const user = mode === "login" ? await apiLogin(username, password) : await apiSignup(username, password);
      onAuthed(user);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="auth-tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Sign up</button>
      </div>
      <form onSubmit={handleSubmit}>
        <input className="field" placeholder="username" value={username} autoComplete="username"
          onChange={(e) => setUsername(e.target.value)} />
        <input className="field" type="password" placeholder="password" value={password}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="error">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>{mode === "login" ? "Log in" : "Create account"}</button>
      </form>
    </div>
  );
}

// ---- Composer ----
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
      setContent(""); setImageUrl(""); setShowImage(false);
      onPosted();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="card composer">
      <div className="row">
        <Avatar name={currentUser.username} />
        <div className="row-main">
          <textarea placeholder="What's happening?" value={content} maxLength={MAX + 20}
            onChange={(e) => setContent(e.target.value)} />
          {showImage && (
            <input className="image-input" placeholder="Paste an image URL (https://...)"
              value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          )}
          {showImage && imageUrl.trim() && (
            <img className="image-preview" src={imageUrl} alt="preview"
              onError={(e) => (e.target.style.display = "none")}
              onLoad={(e) => (e.target.style.display = "block")} />
          )}
          {error && <div className="error">{error}</div>}
          <div className="composer-footer">
            <button className="icon-btn" title="Add an image by URL" onClick={() => setShowImage((s) => !s)}>🖼️</button>
            <span className="spacer"></span>
            <span className={"char-count" + (tooLong ? " over" : "")}>{remaining}</span>
            <button className="btn" onClick={handlePost} disabled={isEmpty || tooLong}>Post</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- CommentThread: the replies under a tweet ----
function CommentThread({ postId, currentUser, onCountChanged }) {
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");

  async function load() {
    try { setComments(await apiGetComments(postId)); } catch (err) { console.error(err); }
  }
  useEffect(() => { load(); }, [postId]);

  async function add(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await apiAddComment(postId, text.trim());
      setText("");
      await load();
      onCountChanged(); // refresh the feed so the 💬 count updates
    } catch (err) { alert(err.message); }
  }

  async function remove(id) {
    try { await apiDeleteComment(postId, id); await load(); onCountChanged(); }
    catch (err) { alert(err.message); }
  }

  return (
    <div className="comments">
      {currentUser && (
        <form className="comment-form" onSubmit={add}>
          <Avatar name={currentUser.username} size={30} />
          <input className="comment-input" placeholder="Write a reply…" value={text}
            maxLength={280} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-sm" type="submit" disabled={!text.trim()}>Reply</button>
        </form>
      )}
      {comments === null ? (
        <div className="muted comment-loading">Loading replies…</div>
      ) : comments.length === 0 ? (
        <div className="muted comment-loading">No replies yet.</div>
      ) : (
        comments.map((c) => (
          <div className="comment" key={c.id}>
            <Avatar name={c.username} size={30} />
            <div className="comment-body">
              <span className="comment-name">{c.display_name || c.username}</span>
              <span className="comment-handle">@{c.username} · {timeAgo(c.created_at)}</span>
              {currentUser && currentUser.username === c.username && (
                <button className="comment-delete" title="Delete reply" onClick={() => remove(c.id)}>×</button>
              )}
              <div className="comment-text">{c.content}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ---- Tweet ----
function Tweet({ tweet, currentUser, onChanged, onOpenProfile }) {
  const [showComments, setShowComments] = useState(false);
  const isMine = currentUser && currentUser.username === tweet.username;

  async function toggleLike() {
    try {
      tweet.liked_by_me ? await apiUnlike(tweet.id) : await apiLike(tweet.id);
      onChanged();
    } catch (err) { alert(err.message); }
  }
  async function toggleRetweet() {
    try {
      tweet.retweeted_by_me ? await apiUnretweet(tweet.id) : await apiRetweet(tweet.id);
      onChanged();
    } catch (err) { alert(err.message); }
  }
  async function handleDelete() {
    if (!confirm("Delete this tweet?")) return;
    try { await apiDeletePost(tweet.id); onChanged(); } catch (err) { alert(err.message); }
  }

  return (
    <div className="card">
      {/* "retweeted by" label, shown when this feed item is a retweet */}
      {tweet.retweeted_by && (
        <div className="retweet-label" onClick={() => onOpenProfile(tweet.retweeted_by)}>
          🔁 @{tweet.retweeted_by} retweeted
        </div>
      )}
      <div className="row">
        <Avatar name={tweet.username} onClick={() => onOpenProfile(tweet.username)} />
        <div className="row-main">
          <div className="tweet-head">
            <span className="tweet-name" onClick={() => onOpenProfile(tweet.username)}>{shownName(tweet)}</span>
            <span className="tweet-handle" onClick={() => onOpenProfile(tweet.username)}>@{tweet.username}</span>
            <span className="tweet-time">· {timeAgo(tweet.created_at)}</span>
            <span className="spacer"></span>
            {isMine && <button className="delete-btn" title="Delete" onClick={handleDelete}>×</button>}
          </div>

          <div className="tweet-content">{tweet.content}</div>
          {tweet.image_url && (
            <img className="tweet-image" src={tweet.image_url} alt=""
              onError={(e) => (e.target.style.display = "none")} />
          )}

          <div className="tweet-actions">
            <button className="action-btn" title="Reply" onClick={() => setShowComments((s) => !s)}>
              💬 {tweet.comment_count}
            </button>
            <button className={"action-btn retweet" + (tweet.retweeted_by_me ? " on" : "")} title="Retweet" onClick={toggleRetweet}>
              🔁 {tweet.retweet_count}
            </button>
            <button className={"action-btn like" + (tweet.liked_by_me ? " on" : "")} title="Like" onClick={toggleLike}>
              {tweet.liked_by_me ? "♥" : "♡"} {tweet.like_count}
            </button>
          </div>

          {showComments && (
            <CommentThread postId={tweet.id} currentUser={currentUser} onCountChanged={onChanged} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Feed ----
function Feed({ tweets, currentUser, onChanged, onOpenProfile }) {
  if (tweets.length === 0) return <div className="empty">No tweets yet. Be the first!</div>;
  return (
    <div>
      {tweets.map((t) => (
        // Composite key: the same post can appear as an original AND a retweet.
        <Tweet key={(t.retweeted_by || "orig") + "-" + t.id} tweet={t}
          currentUser={currentUser} onChanged={onChanged} onOpenProfile={onOpenProfile} />
      ))}
    </div>
  );
}

// ---- Tabs (primary navigation) ----
function Tabs({ active, onSelect }) {
  return (
    <div className="tabs">
      <button className={"tab" + (active === "feed" ? " active" : "")} onClick={() => onSelect("feed")}>Feed</button>
      <button className={"tab" + (active === "sports" ? " active" : "")} onClick={() => onSelect("sports")}>⚽ Sports</button>
    </div>
  );
}

// ---- SportsTab (placeholder until Phase 3 wires the live World Cup API) ----
function SportsTab() {
  return (
    <div className="card sports-placeholder">
      <div className="sports-emoji">⚽🏆</div>
      <h2>World Cup 2026</h2>
      <p className="muted">Live fixtures, scores, and standings are coming in the next update.</p>
    </div>
  );
}

// ---- Profile ----
function Profile({ username, currentUser, onChanged, onOpenProfile, onEdit }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { setData(null); apiGetProfile(username).then(setData).catch((e) => setError(e.message)); }, [username]);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="empty">Loading…</div>;
  const isOwn = currentUser && currentUser.username === data.user.username;

  return (
    <div>
      <div className="profile-banner"></div>
      <div className="card profile-card">
        <div className="profile-top">
          <div className="profile-avatar-ring"><Avatar name={data.user.username} size={92} /></div>
          {isOwn && <button className="btn-ghost" onClick={onEdit}>Edit profile</button>}
        </div>
        <h2 className="profile-name">{shownName(data.user)}</h2>
        <div className="profile-handle">@{data.user.username}</div>
        {data.user.bio && <p className="profile-bio">{data.user.bio}</p>}
        <div className="profile-meta">
          Joined {new Date(data.user.created_at).toLocaleDateString()} · {data.posts.length} post{data.posts.length === 1 ? "" : "s"}
        </div>
      </div>
      <Feed tweets={data.posts} currentUser={currentUser} onChanged={onChanged} onOpenProfile={onOpenProfile} />
    </div>
  );
}

// ---- Settings ----
function Settings({ currentUser, onSaved }) {
  const [displayName, setDisplayName] = useState(currentUser.display_name || "");
  const [bio, setBio] = useState(currentUser.bio || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError(""); setSaved(false);
    try { onSaved(await apiUpdateProfile(displayName.trim(), bio.trim())); setSaved(true); }
    catch (err) { setError(err.message); }
  }

  return (
    <div>
      <h2 className="page-title">Settings</h2>
      <form className="card" onSubmit={handleSave}>
        <label className="field-label">Display name</label>
        <input className="field" placeholder="e.g. Ada Lovelace" value={displayName} maxLength={50}
          onChange={(e) => setDisplayName(e.target.value)} />
        <label className="field-label">Bio</label>
        <textarea className="field" placeholder="A short something about you…" value={bio} maxLength={160}
          onChange={(e) => setBio(e.target.value)} />
        {error && <div className="error">{error}</div>}
        {saved && <div className="success">Saved! ✨</div>}
        <button className="btn" type="submit">Save changes</button>
      </form>
    </div>
  );
}

// ---- App ----
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState({ name: "feed" }); // feed | sports | profile | settings

  async function reloadFeed() {
    setTweets(await apiGetFeed());
  }

  useEffect(() => {
    (async () => {
      try {
        setCurrentUser(await apiGetCurrentUser());
        await reloadFeed();
      } catch (err) { console.error(err); } finally { setLoading(false); }
    })();
  }, []);

  function openProfile(username) { setView({ name: "profile", username }); }
  function selectTab(name) { setView({ name }); if (name === "feed") reloadFeed(); }
  function goHome() { setView({ name: "feed" }); reloadFeed(); }
  async function handleLogout() { await apiLogout(); setCurrentUser(null); setView({ name: "feed" }); reloadFeed(); }
  function handleProfileSaved(u) { setCurrentUser(u); reloadFeed(); }

  return (
    <div className="app">
      <header className="header">
        <div className="logo" onClick={goHome}>✦ BoonTweet</div>
        <div className="header-nav">
          {currentUser ? (
            <>
              <button className="icon-btn" title="Settings" onClick={() => setView({ name: "settings" })}>⚙</button>
              <Avatar name={currentUser.username} size={36} onClick={() => openProfile(currentUser.username)} />
              <button className="btn-ghost" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <span className="muted">Log in to post</span>
          )}
        </div>
      </header>

      <Tabs active={view.name} onSelect={selectTab} />

      {loading ? (
        <div className="empty">Loading…</div>
      ) : view.name === "sports" ? (
        <SportsTab />
      ) : view.name === "settings" ? (
        <Settings currentUser={currentUser} onSaved={handleProfileSaved} />
      ) : view.name === "profile" ? (
        <Profile username={view.username} currentUser={currentUser}
          onChanged={reloadFeed} onOpenProfile={openProfile} onEdit={() => setView({ name: "settings" })} />
      ) : (
        // feed view
        <>
          {currentUser
            ? <Composer currentUser={currentUser} onPosted={reloadFeed} />
            : <AuthForm onAuthed={(u) => { setCurrentUser(u); reloadFeed(); }} />}
          <Feed tweets={tweets} currentUser={currentUser} onChanged={reloadFeed} onOpenProfile={openProfile} />
        </>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
