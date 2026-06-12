// ===========================================================================
// app.jsx — the entire BoonTweet frontend (React, no build step).
// ===========================================================================
// THREE PARTS:
//   PART 1: FAKE DATA      — hardcoded data so the UI works with NO backend.
//   PART 2: API FUNCTIONS  — the "seam": fake data when USE_FAKE_DATA is true,
//                            real fetch() calls when it's false.
//   PART 3: COMPONENTS      — the React UI.
// ===========================================================================

const { useState, useEffect } = React;

// ===========================================================================
// PART 1 — FAKE DATA  (only used when USE_FAKE_DATA === true)
// ===========================================================================

const USE_FAKE_DATA = false; // 🔁 true = no backend needed; false = live server

let FAKE_USER = {
  id: 1, username: "demo", display_name: "Demo Human",
  bio: "Just here learning to build apps. 🚀",
  avatar_url: null, banner_url: null, theme: "neon", avatar_anim: "bird", page_effect: "aurora",
  created_at: new Date().toISOString(),
};

let FAKE_TWEETS = [
  { id: 3, username: "ada", display_name: "Ada L.", avatar_url: null, avatar_anim: "star",
    content: "Just wrote my first SQL query and it returned the right rows. Powerful feeling.",
    image_url: null, created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    like_count: 4, comment_count: 1, retweet_count: 0, liked_by_me: false, retweeted_by_me: false, retweeted_by: null },
  { id: 2, username: "grace", display_name: "Grace H.", avatar_url: null, avatar_anim: null,
    content: "A function that does one thing is easier to debug than one that does five.",
    image_url: "https://picsum.photos/seed/boontweet/600/320",
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    like_count: 12, comment_count: 2, retweet_count: 3, liked_by_me: true, retweeted_by_me: false, retweeted_by: null },
  { id: 1, username: "demo", display_name: "Demo Human", avatar_url: null, avatar_anim: "bird",
    content: "Hello BoonTweet! 🐦 This tweet is fake data — there's no server yet.",
    image_url: null, created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    like_count: 1, comment_count: 0, retweet_count: 0, liked_by_me: false, retweeted_by_me: false, retweeted_by: null },
];

let FAKE_COMMENTS = {
  3: [{ id: 1, username: "grace", display_name: "Grace H.", avatar_url: null, avatar_anim: null, content: "Welcome to the club! 🎉", created_at: new Date().toISOString() }],
  2: [
    { id: 2, username: "ada", display_name: "Ada L.", avatar_url: null, avatar_anim: "star", content: "100%.", created_at: new Date().toISOString() },
    { id: 3, username: "demo", display_name: "Demo Human", avatar_url: null, avatar_anim: "bird", content: "Saving this.", created_at: new Date().toISOString() },
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

// Upload a file. NOTE: we do NOT set Content-Type here — the browser sets the
// multipart boundary itself. Returns the URL to use for the image.
async function apiUploadImage(file) {
  if (USE_FAKE_DATA) return URL.createObjectURL(file); // local-only preview
  const form = new FormData();
  form.append("image", file);
  const res = await fetch("/api/media", { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || "Upload failed");
  return data.url;
}

// ---- Auth ----
async function apiGetCurrentUser() {
  if (USE_FAKE_DATA) return FAKE_USER;
  return (await fetchJson("/api/auth/me")).user;
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
// Save the full profile + appearance (Settings sends every field).
async function apiUpdateProfile(fields) {
  if (USE_FAKE_DATA) { FAKE_USER = { ...FAKE_USER, ...fields }; return FAKE_USER; }
  return (await fetchJson("/api/users/me", { method: "PUT", body: JSON.stringify(fields) })).user;
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
      : { username, display_name: posts[0] && posts[0].display_name, avatar_url: null, banner_url: null, bio: null, created_at: FAKE_USER.created_at };
    return { user, posts };
  }
  return await fetchJson("/api/users/" + encodeURIComponent(username));
}
async function apiCreatePost(content, imageUrl) {
  if (USE_FAKE_DATA) {
    const p = { id: Date.now(), username: FAKE_USER.username, display_name: FAKE_USER.display_name,
      avatar_url: FAKE_USER.avatar_url, avatar_anim: FAKE_USER.avatar_anim,
      content, image_url: imageUrl || null, created_at: new Date().toISOString(),
      like_count: 0, comment_count: 0, retweet_count: 0, liked_by_me: false, retweeted_by_me: false, retweeted_by: null };
    FAKE_TWEETS = [p, ...FAKE_TWEETS];
    return p;
  }
  return await fetchJson("/api/posts", { method: "POST", body: JSON.stringify({ content, image_url: imageUrl }) });
}
async function apiDeletePost(id) {
  if (USE_FAKE_DATA) { FAKE_TWEETS = FAKE_TWEETS.filter((t) => t.id !== id); return; }
  await fetchJson("/api/posts/" + id, { method: "DELETE" });
}

// ---- Likes / retweets ----
async function apiLike(id) { if (USE_FAKE_DATA) return toggleFake(id, "liked_by_me", "like_count", true); await fetchJson("/api/posts/" + id + "/like", { method: "POST" }); }
async function apiUnlike(id) { if (USE_FAKE_DATA) return toggleFake(id, "liked_by_me", "like_count", false); await fetchJson("/api/posts/" + id + "/like", { method: "DELETE" }); }
async function apiRetweet(id) { if (USE_FAKE_DATA) return toggleFake(id, "retweeted_by_me", "retweet_count", true); await fetchJson("/api/posts/" + id + "/retweet", { method: "POST" }); }
async function apiUnretweet(id) { if (USE_FAKE_DATA) return toggleFake(id, "retweeted_by_me", "retweet_count", false); await fetchJson("/api/posts/" + id + "/retweet", { method: "DELETE" }); }
function toggleFake(id, flag, count, on) {
  FAKE_TWEETS = FAKE_TWEETS.map((t) => (t.id === id ? { ...t, [flag]: on, [count]: t[count] + (on ? 1 : -1) } : t));
}

// ---- Comments ----
async function apiGetComments(postId) {
  if (USE_FAKE_DATA) return [...(FAKE_COMMENTS[postId] || [])];
  return await fetchJson("/api/posts/" + postId + "/comments");
}
async function apiAddComment(postId, content) {
  if (USE_FAKE_DATA) {
    const c = { id: Date.now(), username: FAKE_USER.username, display_name: FAKE_USER.display_name, avatar_url: FAKE_USER.avatar_url, avatar_anim: FAKE_USER.avatar_anim, content, created_at: new Date().toISOString() };
    FAKE_COMMENTS[postId] = [...(FAKE_COMMENTS[postId] || []), c];
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

// ---- Sports (World Cup 2026) ----
async function apiGetSports(which) {
  if (USE_FAKE_DATA) {
    return which === "standings"
      ? { configured: true, groups: SAMPLE_STANDINGS }
      : { configured: true, matches: SAMPLE_MATCHES };
  }
  return await fetchJson("/api/sports/" + which);
}

// ===========================================================================
// PART 3 — COMPONENTS
// ===========================================================================

// The animated avatar "mascots" you can pick in Settings (key -> emoji).
const MASCOTS = { bird: "🐦", fox: "🦊", alien: "👾", star: "🌟", ghost: "👻" };
const THEMES = [
  { key: "neon", label: "Neon" },
  { key: "sunset", label: "Sunset" },
  { key: "matrix", label: "Matrix" },
  { key: "bubblegum", label: "Bubblegum" },
];
const EFFECTS = [
  { key: "none", label: "None" },
  { key: "aurora", label: "Aurora" },
  { key: "particles", label: "Particles" },
  { key: "stars", label: "Stars" },
];

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

// ---- Avatar ----
// Priority: uploaded photo (avatar_url) > animated mascot (avatar_anim) >
// a gradient circle with the first initial.
function avatarGradient(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${h1} 85% 60%), hsl(${(h1 + 60) % 360} 85% 50%))`;
}
function Avatar({ user, name, size = 44, onClick }) {
  const u = user || { username: name };
  const label = u.username || name || "?";
  const cls = "avatar" + (onClick ? " clickable" : "");
  const box = { width: size, height: size };

  if (u.avatar_url) {
    return <img className={cls} src={u.avatar_url} alt="" onClick={onClick}
      style={{ ...box, objectFit: "cover" }} />;
  }
  if (u.avatar_anim && MASCOTS[u.avatar_anim]) {
    return (
      <div className={cls + " avatar-mascot"} onClick={onClick}
        style={{ ...box, fontSize: size * 0.55, background: avatarGradient(label) }}>
        <span className="mascot-emoji">{MASCOTS[u.avatar_anim]}</span>
      </div>
    );
  }
  return (
    <div className={cls} onClick={onClick}
      style={{ ...box, fontSize: size * 0.42, background: avatarGradient(label) }}>
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
        <input className="field" placeholder="username" value={username} autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
        <input className="field" type="password" placeholder="password" value={password}
          autoComplete={mode === "login" ? "current-password" : "new-password"} onChange={(e) => setPassword(e.target.value)} />
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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const MAX = 280;
  const remaining = MAX - content.length;
  const isEmpty = content.trim().length === 0;
  const tooLong = content.length > MAX;

  async function onPickFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError(""); setUploading(true);
    try { setImageUrl(await apiUploadImage(file)); }
    catch (err) { setError(err.message); }
    finally { setUploading(false); }
  }
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
        <Avatar user={currentUser} />
        <div className="row-main">
          <textarea placeholder="What's happening?" value={content} maxLength={MAX + 20} onChange={(e) => setContent(e.target.value)} />
          {showImage && (
            <div className="image-tools">
              <label className="btn-ghost btn-sm upload-label">
                {uploading ? "Uploading…" : "📎 Upload"}
                <input type="file" accept="image/*" onChange={onPickFile} hidden />
              </label>
              <input className="image-input" placeholder="…or paste an image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            </div>
          )}
          {showImage && imageUrl.trim() && (
            <img className="image-preview" src={imageUrl} alt="preview" onError={(e) => (e.target.style.display = "none")} onLoad={(e) => (e.target.style.display = "block")} />
          )}
          {error && <div className="error">{error}</div>}
          <div className="composer-footer">
            <button className="icon-btn" title="Add an image" onClick={() => setShowImage((s) => !s)}>🖼️</button>
            <span className="spacer"></span>
            <span className={"char-count" + (tooLong ? " over" : "")}>{remaining}</span>
            <button className="btn" onClick={handlePost} disabled={isEmpty || tooLong || uploading}>Post</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- CommentThread ----
function CommentThread({ postId, currentUser, onCountChanged }) {
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  async function load() { try { setComments(await apiGetComments(postId)); } catch (e) { console.error(e); } }
  useEffect(() => { load(); }, [postId]);

  async function add(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try { await apiAddComment(postId, text.trim()); setText(""); await load(); onCountChanged(); }
    catch (err) { alert(err.message); }
  }
  async function remove(id) {
    try { await apiDeleteComment(postId, id); await load(); onCountChanged(); }
    catch (err) { alert(err.message); }
  }
  return (
    <div className="comments">
      {currentUser && (
        <form className="comment-form" onSubmit={add}>
          <Avatar user={currentUser} size={30} />
          <input className="comment-input" placeholder="Write a reply…" value={text} maxLength={280} onChange={(e) => setText(e.target.value)} />
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
            <Avatar user={c} size={30} />
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
    try { tweet.liked_by_me ? await apiUnlike(tweet.id) : await apiLike(tweet.id); onChanged(); }
    catch (err) { alert(err.message); }
  }
  async function toggleRetweet() {
    try { tweet.retweeted_by_me ? await apiUnretweet(tweet.id) : await apiRetweet(tweet.id); onChanged(); }
    catch (err) { alert(err.message); }
  }
  async function handleDelete() {
    if (!confirm("Delete this tweet?")) return;
    try { await apiDeletePost(tweet.id); onChanged(); } catch (err) { alert(err.message); }
  }

  return (
    <div className="card">
      {tweet.retweeted_by && (
        <div className="retweet-label" onClick={() => onOpenProfile(tweet.retweeted_by)}>🔁 @{tweet.retweeted_by} retweeted</div>
      )}
      <div className="row">
        <Avatar user={tweet} onClick={() => onOpenProfile(tweet.username)} />
        <div className="row-main">
          <div className="tweet-head">
            <span className="tweet-name" onClick={() => onOpenProfile(tweet.username)}>{shownName(tweet)}</span>
            <span className="tweet-handle" onClick={() => onOpenProfile(tweet.username)}>@{tweet.username}</span>
            <span className="tweet-time">· {timeAgo(tweet.created_at)}</span>
            <span className="spacer"></span>
            {isMine && <button className="delete-btn" title="Delete" onClick={handleDelete}>×</button>}
          </div>
          <div className="tweet-content">{tweet.content}</div>
          {tweet.image_url && <img className="tweet-image" src={tweet.image_url} alt="" onError={(e) => (e.target.style.display = "none")} />}
          <div className="tweet-actions">
            <button className="action-btn" title="Reply" onClick={() => setShowComments((s) => !s)}>💬 {tweet.comment_count}</button>
            <button className={"action-btn retweet" + (tweet.retweeted_by_me ? " on" : "")} title="Retweet" onClick={toggleRetweet}>🔁 {tweet.retweet_count}</button>
            <button className={"action-btn like" + (tweet.liked_by_me ? " on" : "")} title="Like" onClick={toggleLike}>{tweet.liked_by_me ? "♥" : "♡"} {tweet.like_count}</button>
          </div>
          {showComments && <CommentThread postId={tweet.id} currentUser={currentUser} onCountChanged={onChanged} />}
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
        <Tweet key={(t.retweeted_by || "orig") + "-" + t.id} tweet={t} currentUser={currentUser} onChanged={onChanged} onOpenProfile={onOpenProfile} />
      ))}
    </div>
  );
}

// ---- Tabs ----
function Tabs({ active, onSelect }) {
  return (
    <div className="tabs">
      <button className={"tab" + (active === "feed" ? " active" : "")} onClick={() => onSelect("feed")}>Feed</button>
      <button className={"tab" + (active === "sports" ? " active" : "")} onClick={() => onSelect("sports")}>⚽ Sports</button>
    </div>
  );
}

// ---- Sports tab: live World Cup 2026 matches + standings ----

// Sample data used only in fake mode (so the tab demos with no backend/key).
const SAMPLE_MATCHES = [
  { id: 1, utcDate: new Date().toISOString(), status: "IN_PLAY", group: "GROUP_A", home: { name: "USA", crest: null }, away: { name: "MEX", crest: null }, homeScore: 1, awayScore: 1 },
  { id: 2, utcDate: new Date(Date.now() + 3 * 3600 * 1000).toISOString(), status: "TIMED", group: "GROUP_B", home: { name: "BRA", crest: null }, away: { name: "ARG", crest: null }, homeScore: null, awayScore: null },
  { id: 3, utcDate: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), status: "FINISHED", group: "GROUP_A", home: { name: "CAN", crest: null }, away: { name: "FRA", crest: null }, homeScore: 0, awayScore: 2 },
];
const SAMPLE_STANDINGS = [
  { group: "GROUP_A", stage: "GROUP_STAGE", table: [
    { position: 1, team: "FRA", crest: null, played: 1, won: 1, draw: 0, lost: 0, gd: 2, points: 3 },
    { position: 2, team: "USA", crest: null, played: 1, won: 0, draw: 1, lost: 0, gd: 0, points: 1 },
    { position: 3, team: "MEX", crest: null, played: 1, won: 0, draw: 1, lost: 0, gd: 0, points: 1 },
    { position: 4, team: "CAN", crest: null, played: 1, won: 0, draw: 0, lost: 1, gd: -2, points: 0 },
  ] },
];

function matchStatus(status) {
  if (status === "IN_PLAY" || status === "PAUSED") return { label: "LIVE", cls: "live" };
  if (status === "FINISHED") return { label: "FT", cls: "ft" };
  return { label: "", cls: "upcoming" }; // SCHEDULED / TIMED -> show kickoff time
}

function MatchRow({ m }) {
  const s = matchStatus(m.status);
  const hasScore = m.homeScore !== null && m.awayScore !== null;
  const time = new Date(m.utcDate).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="match">
      <div className="match-team home">
        <span>{m.home.name}</span>
        {m.home.crest && <img className="crest" src={m.home.crest} alt="" />}
      </div>
      <div className="match-mid">
        {hasScore ? <span className="match-score">{m.homeScore} – {m.awayScore}</span> : <span className="match-vs">vs</span>}
        <span className={"match-status " + s.cls}>{s.label || time}</span>
      </div>
      <div className="match-team away">
        {m.away.crest && <img className="crest" src={m.away.crest} alt="" />}
        <span>{m.away.name}</span>
      </div>
    </div>
  );
}

function MatchSection({ title, items }) {
  return (
    <div className="card sports-section">
      <h3 className="standings-title">{title}</h3>
      {items.map((m) => <MatchRow key={m.id} m={m} />)}
    </div>
  );
}

function Standings({ groups }) {
  if (!groups || groups.length === 0) return <div className="empty">No standings available yet.</div>;
  return (
    <div>
      {groups.map((g) => (
        <div className="card" key={(g.group || g.stage) + ""}>
          <h3 className="standings-title">{(g.group || g.stage || "Table").replace(/_/g, " ")}</h3>
          <table className="standings">
            <thead><tr><th></th><th></th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
            <tbody>
              {g.table.map((r) => (
                <tr key={r.position}>
                  <td className="pos">{r.position}</td>
                  <td className="team">{r.crest && <img className="crest sm" src={r.crest} alt="" />}{r.team}</td>
                  <td>{r.played}</td><td>{r.won}</td><td>{r.draw}</td><td>{r.lost}</td><td>{r.gd}</td><td className="pts">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function SportsTab() {
  const [sub, setSub] = useState("matches");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null); setError("");
    apiGetSports(sub).then(setData).catch((e) => setError(e.message));
  }, [sub]);

  function renderMatches() {
    const matches = data.matches || [];
    if (matches.length === 0) return <div className="empty">No matches found.</div>;
    const byDate = (a, b) => new Date(a.utcDate) - new Date(b.utcDate);
    const live = matches.filter((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
    const upcoming = matches.filter((m) => m.status === "TIMED" || m.status === "SCHEDULED").sort(byDate);
    const finished = matches.filter((m) => m.status === "FINISHED").sort((a, b) => byDate(b, a));
    return (
      <>
        {live.length > 0 && <MatchSection title="🔴 Live now" items={live} />}
        {upcoming.length > 0 && <MatchSection title="Upcoming" items={upcoming.slice(0, 15)} />}
        {finished.length > 0 && <MatchSection title="Results" items={finished.slice(0, 15)} />}
      </>
    );
  }

  return (
    <div>
      <div className="sports-header">
        <h2 className="page-title" style={{ margin: 0 }}>⚽ World Cup 2026</h2>
        <div className="sports-subtabs">
          <button className={sub === "matches" ? "active" : ""} onClick={() => setSub("matches")}>Matches</button>
          <button className={sub === "standings" ? "active" : ""} onClick={() => setSub("standings")}>Standings</button>
        </div>
      </div>

      {error ? (
        <div className="error">{error}</div>
      ) : !data ? (
        <div className="empty">Loading live data…</div>
      ) : data.configured === false ? (
        <div className="card sports-placeholder">
          <div className="sports-emoji">🔑</div>
          <h2>Almost there</h2>
          <p className="muted">
            Live World Cup data needs a free API key. Get one at football-data.org, set the{" "}
            <code>FOOTBALL_DATA_API_KEY</code> environment variable, and redeploy.
          </p>
        </div>
      ) : data.error ? (
        <div className="error">{data.error}</div>
      ) : sub === "matches" ? (
        renderMatches()
      ) : (
        <Standings groups={data.groups} />
      )}
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
  const bannerStyle = data.user.banner_url ? { backgroundImage: `url(${data.user.banner_url})` } : {};

  return (
    <div>
      <div className={"profile-banner" + (data.user.banner_url ? " has-image" : "")} style={bannerStyle}></div>
      <div className="card profile-card">
        <div className="profile-top">
          <div className="profile-avatar-ring"><Avatar user={data.user} size={92} /></div>
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

// ---- A row of selectable option chips (used for theme / mascot / effect) ----
function OptionRow({ options, value, onChange }) {
  return (
    <div className="opt-row">
      {options.map((o) => (
        <button key={o.key} type="button" className={"opt" + (value === o.key ? " active" : "")} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---- Settings (profile + appearance) ----
function Settings({ currentUser, onSaved }) {
  const [displayName, setDisplayName] = useState(currentUser.display_name || "");
  const [bio, setBio] = useState(currentUser.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || "");
  const [bannerUrl, setBannerUrl] = useState(currentUser.banner_url || "");
  const [theme, setTheme] = useState(currentUser.theme || "neon");
  const [avatarAnim, setAvatarAnim] = useState(currentUser.avatar_anim || "");
  const [pageEffect, setPageEffect] = useState(currentUser.page_effect || "none");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState("");

  async function upload(file, setter, which) {
    if (!file) return;
    setError(""); setBusy(which);
    try { setter(await apiUploadImage(file)); }
    catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(""); setSaved(false);
    try {
      const updated = await apiUpdateProfile({
        display_name: displayName.trim(), bio: bio.trim(),
        avatar_url: avatarUrl || null, banner_url: bannerUrl || null,
        theme, avatar_anim: avatarAnim || null, page_effect: pageEffect === "none" ? null : pageEffect,
      });
      onSaved(updated);
      setSaved(true);
    } catch (err) { setError(err.message); }
  }

  // Build the mascot option list (with a "None" choice).
  const mascotOptions = [{ key: "", label: "None" }].concat(
    Object.keys(MASCOTS).map((k) => ({ key: k, label: MASCOTS[k] }))
  );
  // A preview user object so the Avatar reflects the current choices live.
  const previewUser = { username: currentUser.username, avatar_url: avatarUrl, avatar_anim: avatarAnim };

  return (
    <div>
      <h2 className="page-title">Settings</h2>
      <form className="card" onSubmit={handleSave}>
        <label className="field-label">Display name</label>
        <input className="field" placeholder="e.g. Ada Lovelace" value={displayName} maxLength={50} onChange={(e) => setDisplayName(e.target.value)} />

        <label className="field-label">Bio</label>
        <textarea className="field" placeholder="A short something about you…" value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)} />

        <h3 className="settings-section">Appearance</h3>

        <label className="field-label">Profile photo</label>
        <div className="avatar-edit">
          <Avatar user={previewUser} size={64} />
          <label className="btn-ghost btn-sm upload-label">
            {busy === "avatar" ? "Uploading…" : "Upload photo"}
            <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files[0], setAvatarUrl, "avatar")} />
          </label>
          {avatarUrl && <button type="button" className="btn-ghost btn-sm" onClick={() => setAvatarUrl("")}>Remove</button>}
        </div>
        {!avatarUrl && <div className="hint">No photo? Pick an animated mascot below, or we'll use a colorful initial.</div>}

        <label className="field-label">Banner</label>
        <div className={"banner-preview" + (bannerUrl ? " has-image" : "")} style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : {}}></div>
        <div className="avatar-edit">
          <label className="btn-ghost btn-sm upload-label">
            {busy === "banner" ? "Uploading…" : "Upload banner"}
            <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files[0], setBannerUrl, "banner")} />
          </label>
          {bannerUrl && <button type="button" className="btn-ghost btn-sm" onClick={() => setBannerUrl("")}>Remove</button>}
        </div>

        <label className="field-label">Theme (applies after you save)</label>
        <OptionRow options={THEMES} value={theme} onChange={setTheme} />

        <label className="field-label">Animated mascot {avatarUrl ? "(hidden while a photo is set)" : ""}</label>
        <OptionRow options={mascotOptions} value={avatarAnim} onChange={setAvatarAnim} />

        <label className="field-label">Background effect</label>
        <OptionRow options={EFFECTS} value={pageEffect} onChange={setPageEffect} />

        {error && <div className="error">{error}</div>}
        {saved && <div className="success">Saved! ✨</div>}
        <button className="btn" type="submit" disabled={!!busy}>Save changes</button>
      </form>
    </div>
  );
}

// ---- App ----
function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState({ name: "feed" });

  async function reloadFeed() { setTweets(await apiGetFeed()); }

  useEffect(() => {
    (async () => {
      try { setCurrentUser(await apiGetCurrentUser()); await reloadFeed(); }
      catch (err) { console.error(err); } finally { setLoading(false); }
    })();
  }, []);

  // Apply the logged-in user's theme + background effect to the whole page.
  useEffect(() => {
    document.body.dataset.theme = (currentUser && currentUser.theme) || "neon";
    document.body.dataset.effect = (currentUser && currentUser.page_effect) || "none";
  }, [currentUser]);

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
              <Avatar user={currentUser} size={36} onClick={() => openProfile(currentUser.username)} />
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
        <Profile username={view.username} currentUser={currentUser} onChanged={reloadFeed} onOpenProfile={openProfile} onEdit={() => setView({ name: "settings" })} />
      ) : (
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
