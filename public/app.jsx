// ===========================================================================
// app.jsx — BoonTweet frontend (React via CDN, no build step).
// ===========================================================================
// Implements the "BoonTweet — Themes" design: 8 live-switchable themes with a
// layout engine (sidebar vs top-tabs nav, card styles, density), wired to the
// real Express + Postgres backend. Theme/styling lives in style.css under
// [data-theme] / [data-nav] / [data-card] / [data-density]; this file sets
// those attributes and renders the design's components against real data.
//
//  PART 1: theme metadata + fake data (USE_FAKE_DATA seam)
//  PART 2: API functions (fake data vs real fetch)
//  PART 3: components, screens, the Appearance panel, and the App controller
// ===========================================================================

const { useState, useEffect, useRef } = React;

// ===========================================================================
// PART 1 — theme registry + fake data
// ===========================================================================

const USE_FAKE_DATA = false; // 🔁 true = browse a mock with no backend; false = live server

// The 8 themes. CSS for each lives in style.css ([data-theme="…"]); here we
// keep the human-facing name, blurb, the curated accent palette, and the
// layout defaults a theme "snaps" to when you pick it.
const THEMES = [
  { id: 'neon',      name: 'Dark Neon',   blurb: 'Glassy black + cyan/magenta glow',     accent: '#22d3ee', nav: 'sidebar', card: 'glassy',   density: 'spacious', accents: ['#22d3ee', '#e879f9', '#a3e635', '#fb923c', '#818cf8'] },
  { id: 'light',     name: 'Clean Light', blurb: 'Minimal, white, bordered',             accent: '#2563eb', nav: 'tabs',    card: 'rows',     density: 'regular',  accents: ['#2563eb', '#0ea5e9', '#7c3aed', '#e11d48', '#059669'] },
  { id: 'y2k',       name: 'Y2K Pop',     blurb: 'Candy colors, chunky outlines',        accent: '#ff2d9b', nav: 'sidebar', card: 'flat',     density: 'spacious', accents: ['#ff2d9b', '#7857ff', '#00c2ff', '#ffb300', '#00c853'] },
  { id: 'brutalist', name: 'Brutalist',   blurb: 'Hard borders, no curves, loud',        accent: '#1f3bff', nav: 'tabs',    card: 'bordered', density: 'compact',  accents: ['#1f3bff', '#ff3b1f', '#000000', '#008a3c', '#ff00aa'] },
  { id: 'terminal',  name: 'Terminal',    blurb: 'Green phosphor + scanlines',           accent: '#62ff00', nav: 'sidebar', card: 'rows',     density: 'compact',  accents: ['#62ff00', '#ffd400', '#00e5ff', '#ff5c8a', '#ff8a00'] },
  { id: 'glass',     name: 'Glass',       blurb: 'Frosted panes on a color blur',        accent: '#a78bfa', nav: 'sidebar', card: 'glassy',   density: 'spacious', accents: ['#a78bfa', '#5eead4', '#f0abfc', '#7dd3fc', '#fda4af'] },
  { id: 'editorial', name: 'Editorial',   blurb: 'Warm paper, serif, ink',               accent: '#b5471f', nav: 'tabs',    card: 'rows',     density: 'regular',  accents: ['#b5471f', '#1f6b5c', '#8a6d1f', '#7b3f6e', '#2c2419'] },
  { id: 'cozy',      name: 'Cozy Pastel', blurb: 'Soft lavender, rounded, gentle',       accent: '#8b7be8', nav: 'sidebar', card: 'flat',     density: 'spacious', accents: ['#8b7be8', '#5ec5b6', '#f48fb1', '#7cb6f0', '#f0a868'] },
];
const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

const FONTS = [
  { value: '', label: 'Theme default' },
  { value: "'Space Grotesk', system-ui, sans-serif", label: 'Space Grotesk' },
  { value: "'Plus Jakarta Sans', system-ui, sans-serif", label: 'Plus Jakarta' },
  { value: "'Sora', system-ui, sans-serif", label: 'Sora' },
  { value: "'Fredoka', system-ui, sans-serif", label: 'Fredoka' },
  { value: "'Archivo', system-ui, sans-serif", label: 'Archivo' },
  { value: "'Quicksand', system-ui, sans-serif", label: 'Quicksand' },
  { value: "'Newsreader', Georgia, serif", label: 'Newsreader' },
  { value: "'Space Mono', ui-monospace, monospace", label: 'Space Mono' },
  { value: 'system-ui, -apple-system, sans-serif', label: 'System' },
];

// Static, decorative trends for the sidebar aside (the design's were mock too).
const TRENDS = [
  { cat: 'World Cup · Live', tt: '#WorldCup2026', ct: '1.2M posts' },
  { cat: 'Sports · Trending', tt: 'Group of Death', ct: '40.5K posts' },
  { cat: 'Trending in Tech', tt: '4px shadows', ct: '12.1K posts' },
];

// --- minimal fake data (only used when USE_FAKE_DATA === true) ---
let FAKE_USER = { id: 1, username: 'demo', display_name: 'Demo Human', bio: 'Browsing the mock 🛰️', avatar_url: null, banner_url: null, theme: 'neon', created_at: new Date().toISOString() };
let FAKE_TWEETS = [
  { id: 2, username: 'ada', display_name: 'Ada L.', avatar_url: null, content: 'First SQL query returned the right rows. Powerful feeling.', image_url: null, created_at: new Date(Date.now() - 6e5).toISOString(), like_count: 12, comment_count: 1, retweet_count: 2, liked_by_me: true, retweeted_by_me: false, retweeted_by: null },
  { id: 1, username: 'demo', display_name: 'Demo Human', avatar_url: null, content: 'Hello BoonTweet! 🐦 (fake data — no server)', image_url: 'https://picsum.photos/seed/boon/600/340', created_at: new Date(Date.now() - 36e5).toISOString(), like_count: 3, comment_count: 0, retweet_count: 0, liked_by_me: false, retweeted_by_me: false, retweeted_by: null },
];
let FAKE_COMMENTS = { 2: [{ id: 1, username: 'demo', display_name: 'Demo Human', avatar_url: null, content: 'congrats!', created_at: new Date().toISOString() }] };
const FAKE_SPORTS = {
  matches: [
    { id: 1, utcDate: new Date().toISOString(), status: 'IN_PLAY', group: 'GROUP C', home: { name: 'Argentina', crest: null }, away: { name: 'Croatia', crest: null }, homeScore: 2, awayScore: 1 },
    { id: 2, utcDate: new Date(Date.now() + 1e7).toISOString(), status: 'TIMED', group: 'GROUP E', home: { name: 'France', crest: null }, away: { name: 'USA', crest: null }, homeScore: null, awayScore: null },
    { id: 3, utcDate: new Date(Date.now() - 1e7).toISOString(), status: 'FINISHED', group: 'GROUP A', home: { name: 'Mexico', crest: null }, away: { name: 'Japan', crest: null }, homeScore: 3, awayScore: 1 },
  ],
  groups: [{ group: 'GROUP C', table: [
    { position: 1, team: 'Argentina', crest: null, played: 2, won: 2, draw: 0, lost: 0, gd: 3, points: 6 },
    { position: 2, team: 'Brazil', crest: null, played: 2, won: 1, draw: 1, lost: 0, gd: 2, points: 4 },
    { position: 3, team: 'Croatia', crest: null, played: 2, won: 0, draw: 1, lost: 1, gd: -1, points: 1 },
    { position: 4, team: 'Nigeria', crest: null, played: 2, won: 0, draw: 0, lost: 2, gd: -4, points: 0 },
  ] }],
};

// ===========================================================================
// PART 2 — API functions
// ===========================================================================

// Read the CSRF token the server set in a (non-httpOnly) cookie, so we can echo
// it back in a header on state-changing requests (see server.js).
function getCsrf() {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrf(), ...(options.headers || {}) },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

async function apiUploadImage(file) {
  if (USE_FAKE_DATA) return URL.createObjectURL(file);
  const form = new FormData();
  form.append('image', file);
  const res = await fetch('/api/media', { method: 'POST', body: form, headers: { 'x-csrf-token': getCsrf() } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || 'Upload failed');
  return data.url;
}

async function apiGetCurrentUser() { if (USE_FAKE_DATA) return FAKE_USER; return (await fetchJson('/api/auth/me')).user; }
async function apiSignup(u, p) { if (USE_FAKE_DATA) return FAKE_USER; return (await fetchJson('/api/auth/signup', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })).user; }
async function apiLogin(u, p) { if (USE_FAKE_DATA) return FAKE_USER; return (await fetchJson('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })).user; }
async function apiLogout() { if (USE_FAKE_DATA) return; await fetchJson('/api/auth/logout', { method: 'POST' }); }
async function apiUpdateProfile(fields) { if (USE_FAKE_DATA) { FAKE_USER = { ...FAKE_USER, ...fields }; return FAKE_USER; } return (await fetchJson('/api/users/me', { method: 'PUT', body: JSON.stringify(fields) })).user; }

async function apiGetFeed(before, scope) {
  if (USE_FAKE_DATA) return [...FAKE_TWEETS];
  let q = '?limit=20';
  if (before) q += '&before=' + encodeURIComponent(before);
  if (scope === 'following') q += '&scope=following';
  return await fetchJson('/api/posts' + q);
}
async function apiFollow(username) { if (USE_FAKE_DATA) return; await fetchJson('/api/users/' + encodeURIComponent(username) + '/follow', { method: 'POST' }); }
async function apiUnfollow(username) { if (USE_FAKE_DATA) return; await fetchJson('/api/users/' + encodeURIComponent(username) + '/follow', { method: 'DELETE' }); }
async function apiSearch(q) {
  if (USE_FAKE_DATA) { const k = q.toLowerCase().replace(/^#/, ''); return { users: [], posts: FAKE_TWEETS.filter((t) => t.content.toLowerCase().includes(k)) }; }
  return await fetchJson('/api/search?q=' + encodeURIComponent(q));
}
async function apiGetProfile(username) {
  if (USE_FAKE_DATA) {
    const posts = FAKE_TWEETS.filter((t) => t.username === username);
    const user = username === FAKE_USER.username ? FAKE_USER : { username, display_name: username, avatar_url: null, banner_url: null, bio: null, created_at: FAKE_USER.created_at };
    return { user, posts };
  }
  return await fetchJson('/api/users/' + encodeURIComponent(username));
}
async function apiCreatePost(content, imageUrl) {
  if (USE_FAKE_DATA) { const p = { id: Date.now(), username: FAKE_USER.username, display_name: FAKE_USER.display_name, avatar_url: FAKE_USER.avatar_url, content, image_url: imageUrl || null, created_at: new Date().toISOString(), like_count: 0, comment_count: 0, retweet_count: 0, liked_by_me: false, retweeted_by_me: false, retweeted_by: null }; FAKE_TWEETS = [p, ...FAKE_TWEETS]; return p; }
  return await fetchJson('/api/posts', { method: 'POST', body: JSON.stringify({ content, image_url: imageUrl }) });
}
async function apiDeletePost(id) { if (USE_FAKE_DATA) { FAKE_TWEETS = FAKE_TWEETS.filter((t) => t.id !== id); return; } await fetchJson('/api/posts/' + id, { method: 'DELETE' }); }

function fakeToggle(id, flag, count, on) { FAKE_TWEETS = FAKE_TWEETS.map((t) => (t.id === id ? { ...t, [flag]: on, [count]: t[count] + (on ? 1 : -1) } : t)); }
async function apiLike(id) { if (USE_FAKE_DATA) return fakeToggle(id, 'liked_by_me', 'like_count', true); await fetchJson('/api/posts/' + id + '/like', { method: 'POST' }); }
async function apiUnlike(id) { if (USE_FAKE_DATA) return fakeToggle(id, 'liked_by_me', 'like_count', false); await fetchJson('/api/posts/' + id + '/like', { method: 'DELETE' }); }
async function apiRetweet(id) { if (USE_FAKE_DATA) return fakeToggle(id, 'retweeted_by_me', 'retweet_count', true); await fetchJson('/api/posts/' + id + '/retweet', { method: 'POST' }); }
async function apiUnretweet(id) { if (USE_FAKE_DATA) return fakeToggle(id, 'retweeted_by_me', 'retweet_count', false); await fetchJson('/api/posts/' + id + '/retweet', { method: 'DELETE' }); }

async function apiGetComments(postId) { if (USE_FAKE_DATA) return [...(FAKE_COMMENTS[postId] || [])]; return await fetchJson('/api/posts/' + postId + '/comments'); }
async function apiAddComment(postId, content) {
  if (USE_FAKE_DATA) { const c = { id: Date.now(), username: FAKE_USER.username, display_name: FAKE_USER.display_name, avatar_url: FAKE_USER.avatar_url, content, created_at: new Date().toISOString() }; FAKE_COMMENTS[postId] = [...(FAKE_COMMENTS[postId] || []), c]; return c; }
  return await fetchJson('/api/posts/' + postId + '/comments', { method: 'POST', body: JSON.stringify({ content }) });
}
async function apiDeleteComment(postId, commentId) { if (USE_FAKE_DATA) { FAKE_COMMENTS[postId] = (FAKE_COMMENTS[postId] || []).filter((c) => c.id !== commentId); return; } await fetchJson('/api/posts/' + postId + '/comments/' + commentId, { method: 'DELETE' }); }

async function apiGetSports(which) { if (USE_FAKE_DATA) return { configured: true, matches: FAKE_SPORTS.matches, groups: FAKE_SPORTS.groups }; return await fetchJson('/api/sports/' + which); }

// ===========================================================================
// PART 3 — helpers, components, screens, controller
// ===========================================================================

function avatarGradient(seed) {
  seed = seed || '?';
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 72% 56%), hsl(${(h + 56) % 360} 70% 48%))`;
}
function initials(name) {
  return (name || '?').replace(/[^a-zA-Z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60); if (m < 60) return m + 'm';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}
function fmt(n) { n = n || 0; if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'K'; return String(n); }

// Turn @mentions and #hashtags inside tweet text into clickable links.
// @name -> that profile; #tag -> a search for that tag.
function renderRich(text, go) {
  if (!text || !go) return text;
  const s = String(text);
  const out = [];
  const re = /[@#]\w+/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    const onClick = tok[0] === '@' ? () => go('profile', tok.slice(1)) : () => go('search', tok);
    out.push(<a key={i++} className="link" onClick={(e) => { e.stopPropagation(); onClick(); }}>{tok}</a>);
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

// ---- Icons (stroke, currentColor) ----
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  bell: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Zm3.5 9a2.5 2.5 0 0 0 5 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm6 13 4 4',
  feather: 'M20 4C12 4 6 9 6 16l-2 4 4-2c7 0 12-6 12-14ZM6 16l8-8',
  reply: 'M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z',
  rt: 'M4 9l3-3 3 3M7 6v8a3 3 0 0 0 3 3h7m3-5-3 3-3-3m3 3V8a3 3 0 0 0-3-3H7',
  heart: 'M12 20s-7-4.4-9.3-8.4A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 9.3 5.6C19 15.6 12 20 12 20Z',
  share: 'M12 16V4m0 0 4 4m-4-4-4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  back: 'M15 5l-7 7 7 7',
  cal: 'M5 5h14v15H5zM5 9h14M9 3v4M15 3v4',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5',
  trophy: 'M7 4h10v4a5 5 0 0 1-10 0V4ZM5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M9 14h6M12 14v4m-3 2h6',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3a8 8 0 0 0-.2-1.7l2-1.6-2-3.4-2.3 1a8 8 0 0 0-3-1.7L14 2h-4l-.5 2.6a8 8 0 0 0-3 1.7l-2.3-1-2 3.4 2 1.6A8 8 0 0 0 4 12c0 .6.1 1.1.2 1.7l-2 1.6 2 3.4 2.3-1a8 8 0 0 0 3 1.7L10 22h4l.5-2.6a8 8 0 0 0 3-1.7l2.3 1 2-3.4-2-1.6c.1-.6.2-1.1.2-1.7Z',
  logout: 'M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4m7 14 5-5-5-5m5 5H9',
};
function Icon({ name, className = 'ico', fill }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// ---- Avatar (uploaded photo → gradient + initials) ----
function Avatar({ user, handle, size }) {
  const u = user || { username: handle, display_name: handle };
  const seed = u.username || handle || '?';
  const name = u.display_name || u.username || handle || '?';
  const style = size ? { width: size, height: size, fontSize: size * 0.4 } : {};
  if (u.avatar_url) {
    return <img className="avatar" src={u.avatar_url} alt="" style={{ ...style, objectFit: 'cover' }} />;
  }
  return <div className="avatar" style={{ ...style, background: avatarGradient(seed) }}>{initials(name)}</div>;
}

// ---- Tweet card ----
function Tweet({ tweet, currentUser, isCard, onOpen, onLike, onRt, onDelete, onShare, onOpenProfile, go }) {
  const name = tweet.display_name || tweet.username;
  const isMine = currentUser && currentUser.username === tweet.username;
  const stop = (e, fn) => { e.stopPropagation(); fn && fn(); };
  return (
    <article className={'tweet' + (isCard ? ' is-card' : '')} onClick={() => onOpen && onOpen(tweet)}>
      <div onClick={(e) => stop(e, () => onOpenProfile(tweet.username))} style={{ alignSelf: 'flex-start' }}>
        <Avatar user={tweet} />
      </div>
      <div className="tweet-main">
        <div className="tweet-head">
          <span className="name" onClick={(e) => stop(e, () => onOpenProfile(tweet.username))}>{name}</span>
          <span className="handle">@{tweet.username}</span>
          <span className="dot">·</span>
          <span className="time">{timeAgo(tweet.created_at)}</span>
          {isMine && <button className="iconbtn more" title="Delete tweet" onClick={(e) => stop(e, () => onDelete(tweet.id))}><Icon name="more" /></button>}
        </div>
        <p className="tweet-text">{renderRich(tweet.content, go)}</p>
        {tweet.image_url && (
          <div className="media bare">
            <img src={tweet.image_url} alt="" onError={(e) => { const m = e.target.closest('.media'); if (m) m.style.display = 'none'; }} />
          </div>
        )}
        <div className="actions">
          <button className="act reply" onClick={(e) => stop(e, () => onOpen(tweet))}><span className="ico-wrap"><Icon name="reply" /></span>{fmt(tweet.comment_count)}</button>
          <button className="act rt" data-on={tweet.retweeted_by_me ? '1' : '0'} onClick={(e) => stop(e, () => onRt(tweet))}><span className="ico-wrap"><Icon name="rt" /></span>{fmt(tweet.retweet_count)}</button>
          <button className="act like" data-on={tweet.liked_by_me ? '1' : '0'} onClick={(e) => stop(e, () => onLike(tweet))}><span className="ico-wrap"><Icon name="heart" fill={tweet.liked_by_me} /></span>{fmt(tweet.like_count)}</button>
          <button className="act share" onClick={(e) => stop(e, onShare)}><span className="ico-wrap"><Icon name="share" /></span></button>
        </div>
      </div>
    </article>
  );
}

// ---- Compose box ----
function Compose({ currentUser, onPost, placeholder = "What's happening?", replying, autoFocus }) {
  const [text, setText] = useState('');
  const [showImg, setShowImg] = useState(false);
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef(null);
  useEffect(() => { if (autoFocus && ref.current) ref.current.focus(); }, [autoFocus]);

  const left = 280 - text.length, over = left < 0;
  const pct = Math.min(100, (text.length / 280) * 100);
  const R = 12, C = 2 * Math.PI * R;

  async function pick(e) {
    const f = e.target.files[0]; if (!f) return;
    setErr(''); setUploading(true);
    try { setUrl(await apiUploadImage(f)); } catch (x) { setErr(x.message); } finally { setUploading(false); }
  }
  function submit() {
    if (!text.trim() || over) return;
    onPost({ text: text.trim(), imageUrl: url.trim() || null });
    setText(''); setUrl(''); setShowImg(false);
  }

  return (
    <div className="compose">
      <Avatar user={currentUser} />
      <div className="compose-main">
        <textarea ref={ref} value={text} placeholder={placeholder} rows={1}
          onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} />
        {showImg && (
          <input className="compose-url" value={url} placeholder="Paste an image URL…" onChange={(e) => setUrl(e.target.value)} />
        )}
        {showImg && url.trim() && (
          <div className="media bare" style={{ marginTop: 10 }}><img src={url} alt="preview" onError={(e) => { const m = e.target.closest('.media'); if (m) m.style.display = 'none'; }} /></div>
        )}
        {err && <div className="form-err">{err}</div>}
        <div className="compose-foot">
          <div className="compose-tools">
            <button className="tool" data-on={showImg ? '1' : '0'} title="Add an image" onClick={() => setShowImg((s) => !s)}><Icon name="image" /></button>
            <label className="tool upload-label" title="Upload an image">
              <Icon name="feather" />
              <input type="file" accept="image/*" hidden onChange={pick} />
            </label>
            {uploading && <span className="charcount">↑…</span>}
          </div>
          <div className="compose-right">
            {text.length > 0 && (
              <div className="charwrap" title={left + ' left'}>
                <svg width="28" height="28">
                  <circle cx="14" cy="14" r={R} fill="none" stroke="var(--border)" strokeWidth="2.5" />
                  <circle cx="14" cy="14" r={R} fill="none" strokeWidth="2.5" strokeLinecap="round" stroke={over ? 'var(--like)' : 'var(--accent)'} strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} transform="rotate(-90 14 14)" />
                </svg>
              </div>
            )}
            {text.length > 240 && <span className="charcount" data-warn={over ? '1' : '0'}>{left}</span>}
            <button className="post-btn" disabled={!text.trim() || over || uploading} onClick={submit}>{replying ? 'Reply' : 'Tweet'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Reply (comment) row in tweet detail ----
function ReplyRow({ c, currentUser, onDelete, onOpenProfile, go }) {
  const isMine = currentUser && currentUser.username === c.username;
  return (
    <div className="reply-row">
      <div onClick={() => onOpenProfile(c.username)} style={{ cursor: 'pointer', alignSelf: 'flex-start' }}><Avatar user={c} /></div>
      <div className="reply-main">
        <div className="tweet-head">
          <span className="name" onClick={() => onOpenProfile(c.username)} style={{ cursor: 'pointer' }}>{c.display_name || c.username}</span>
          <span className="handle">@{c.username}</span>
          <span className="dot">·</span>
          <span className="time">{timeAgo(c.created_at)}</span>
          {isMine && <button className="reply-del" title="Delete reply" onClick={() => onDelete(c.id)}>×</button>}
        </div>
        <p className="tweet-text">{renderRich(c.content, go)}</p>
      </div>
    </div>
  );
}

// ---- Navigation ----
const NAV = [
  { id: 'feed', label: 'Home', icon: 'home' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'sports', label: 'Sports', icon: 'trophy' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

function Sidebar({ route, currentUser, go, onCompose, onLogout }) {
  return (
    <nav className="sidebar collapsed-labels">
      <div className="brand">
        <div className="brand-mark">b</div>
        <div className="brand-word">boon<b>tweet</b></div>
      </div>
      {NAV.map((n) => (
        <button key={n.id} className="nav-item" data-active={route.name === n.id ? '1' : '0'}
          onClick={() => go(n.id, n.id === 'profile' ? currentUser.username : null)}>
          <Icon name={n.icon} /><span className="nav-label">{n.label}</span>
        </button>
      ))}
      <button className="compose-full" onClick={onCompose}><Icon name="feather" /><span>Tweet</span></button>
      <button className="nav-item" onClick={onLogout}><Icon name="logout" /><span className="nav-label">Log out</span></button>
      <button className="side-me" onClick={() => go('profile', currentUser.username)}>
        <Avatar user={currentUser} size={40} />
        <div className="nav-label">
          <div className="nm">{currentUser.display_name || currentUser.username}</div>
          <div className="hd">@{currentUser.username}</div>
        </div>
      </button>
    </nav>
  );
}

function TopNav({ route, currentUser, go }) {
  return (
    <div className="topnav">
      <div className="topnav-bar">
        <div className="brand">
          <div className="brand-mark">b</div>
          <div className="brand-word">boon<b>tweet</b></div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="iconbtn" title="Search" onClick={() => go('search')}><Icon name="search" /></button>
          <button className="iconbtn" title="Settings" onClick={() => go('settings')}><Icon name="settings" /></button>
          <button className="iconbtn" onClick={() => go('profile', currentUser.username)} aria-label="Profile"><Avatar user={currentUser} size={34} /></button>
        </div>
      </div>
      <div className="topnav-tabs">
        {NAV.filter((n) => n.id !== 'settings' && n.id !== 'search').map((n) => (
          <button key={n.id} className="top-tab" data-active={route.name === n.id ? '1' : '0'}
            onClick={() => go(n.id, n.id === 'profile' ? currentUser.username : null)}>{n.label}</button>
        ))}
      </div>
    </div>
  );
}

function Aside({ go }) {
  const [q, setQ] = useState('');
  return (
    <aside className="aside">
      <div className="search">
        <Icon name="search" />
        <input placeholder="Search BoonTweet" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) go('search', q.trim()); }} />
      </div>
      <div className="widget">
        <h3>Trending</h3>
        {TRENDS.map((t, i) => (
          <div className="trend" key={i} onClick={() => go('sports')}>
            <div className="cat">{t.cat}</div>
            <div className="tt">{t.tt}</div>
            <div className="ct">{t.ct}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ---- Appearance panel (user-facing theme/layout picker) ----
function AppearancePanel({ tweaks, onPick, onSet }) {
  const [open, setOpen] = useState(false);
  const theme = THEME_BY_ID[tweaks.theme] || THEMES[0];
  const optRow = (key, opts) => (
    <div className="cz-row">
      {opts.map(([v, l]) => (
        <button key={v} className="cz-opt" data-on={tweaks[key] === v ? '1' : '0'} onClick={() => onSet(key, v)}>{l}</button>
      ))}
    </div>
  );
  return (
    <>
      <button className="cz-fab" title="Customize appearance" onClick={() => setOpen((o) => !o)}>🎨</button>
      {open && (
        <div className="cz-panel">
          <button className="cz-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          <h4>Customize</h4>
          <div className="cz-blurb">{theme.blurb}</div>

          <div className="cz-sect">Theme</div>
          <div className="cz-row">
            {THEMES.map((t) => (
              <button key={t.id} className="cz-opt" data-on={tweaks.theme === t.id ? '1' : '0'} onClick={() => onPick(t.id)}>{t.name}</button>
            ))}
          </div>

          <div className="cz-sect">Accent</div>
          <div className="cz-swatches">
            {theme.accents.map((c) => (
              <button key={c} className="cz-swatch" data-on={tweaks.accent === c ? '1' : '0'} style={{ background: c }} onClick={() => onSet('accent', c)} aria-label={c} />
            ))}
          </div>

          <div className="cz-sect">Font</div>
          <select className="cz-select" value={tweaks.font} onChange={(e) => onSet('font', e.target.value)}>
            {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
          </select>

          <div className="cz-sect">Navigation</div>
          {optRow('nav', [['sidebar', 'Sidebar'], ['tabs', 'Top tabs']])}
          <div className="cz-sect">Cards</div>
          {optRow('cards', [['rows', 'Rows'], ['bordered', 'Bordered'], ['glassy', 'Glassy'], ['flat', 'Flat']])}
          <div className="cz-sect">Density</div>
          {optRow('density', [['compact', 'Compact'], ['regular', 'Regular'], ['spacious', 'Spacious']])}
        </div>
      )}
    </>
  );
}

// ---- Screens ----
function FeedScreen({ posts, currentUser, cards, onPost, handlers, go, onLoadMore, hasMore, loadingMore, scope, onScope }) {
  // Infinite scroll: when the sentinel scrolls into view, load the next page.
  const sentinel = useRef(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) onLoadMore(); }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, onLoadMore, posts.length]);

  const emptyMsg = scope === 'following'
    ? 'Your Following feed is empty — open a profile and Follow someone to fill it.'
    : 'No tweets yet — post the first ✦';

  return (
    <div className="feed-col">
      <div className="col-head"><div><h1>Home</h1></div></div>
      <div className="profile-tabs feed-scope">
        <button className="p-tab" data-active={scope === 'all' ? '1' : '0'} onClick={() => onScope('all')}>For you</button>
        <button className="p-tab" data-active={scope === 'following' ? '1' : '0'} onClick={() => onScope('following')}>Following</button>
      </div>
      <div className={'feed-list' + (cards ? ' cards' : '')}>
        {scope === 'all' && <Compose currentUser={currentUser} onPost={onPost} />}
        {posts.map((t) => (
          <React.Fragment key={(t.retweeted_by || 'orig') + '-' + t.id}>
            {t.retweeted_by && (
              <div className="retweet-tag" style={{ paddingTop: 'var(--pad)' }}><Icon name="rt" /> {t.retweeted_by} retweeted</div>
            )}
            <Tweet tweet={t} currentUser={currentUser} isCard={cards} go={go} onOpenProfile={(h) => go('profile', h)} {...handlers} />
          </React.Fragment>
        ))}
        {posts.length === 0 && <div className="empty">{emptyMsg}</div>}
        {posts.length > 0 && hasMore && <div ref={sentinel} className="empty">{loadingMore ? 'Loading…' : ''}</div>}
        {posts.length > 0 && !hasMore && <div className="empty">You're all caught up ✦</div>}
      </div>
    </div>
  );
}

function TweetDetailScreen({ tweet: initial, currentUser, cards, onBack, onChanged, go }) {
  const [tw, setTw] = useState(initial);
  const [comments, setComments] = useState(null);
  useEffect(() => { setTw(initial); }, [initial.id]);

  async function loadComments() { try { setComments(await apiGetComments(tw.id)); } catch (e) { console.error(e); } }
  useEffect(() => { loadComments(); }, [tw.id]);

  async function like() {
    const on = !tw.liked_by_me;
    setTw((p) => ({ ...p, liked_by_me: on, like_count: p.like_count + (on ? 1 : -1) }));
    try { on ? await apiLike(tw.id) : await apiUnlike(tw.id); } catch (e) { alert(e.message); }
    onChanged && onChanged();
  }
  async function rt() {
    const on = !tw.retweeted_by_me;
    setTw((p) => ({ ...p, retweeted_by_me: on, retweet_count: p.retweet_count + (on ? 1 : -1) }));
    try { on ? await apiRetweet(tw.id) : await apiUnretweet(tw.id); } catch (e) { alert(e.message); }
    onChanged && onChanged();
  }
  async function postReply({ text }) {
    try { await apiAddComment(tw.id, text); } catch (e) { alert(e.message); return; }
    setTw((p) => ({ ...p, comment_count: (p.comment_count || 0) + 1 }));
    await loadComments(); onChanged && onChanged();
  }
  async function delReply(id) {
    try { await apiDeleteComment(tw.id, id); } catch (e) { alert(e.message); return; }
    setTw((p) => ({ ...p, comment_count: Math.max(0, (p.comment_count || 1) - 1) }));
    await loadComments(); onChanged && onChanged();
  }

  const name = tw.display_name || tw.username;
  return (
    <div className="feed-col">
      <div className="col-head">
        <button className="iconbtn back-btn" onClick={onBack} aria-label="Back"><Icon name="back" /></button>
        <div><h1>Tweet</h1></div>
      </div>
      <div className="detail-tweet">
        <div className="head-row">
          <div onClick={() => go('profile', tw.username)} style={{ cursor: 'pointer' }}><Avatar user={tw} size={48} /></div>
          <div style={{ flex: 1 }}>
            <div className="name" onClick={() => go('profile', tw.username)} style={{ cursor: 'pointer' }}>{name}</div>
            <div className="handle">@{tw.username}</div>
          </div>
        </div>
        <p className="detail-text">{renderRich(tw.content, go)}</p>
        {tw.image_url && <div className="media bare" style={{ marginTop: 16 }}><img src={tw.image_url} alt="" onError={(e) => { const m = e.target.closest('.media'); if (m) m.style.display = 'none'; }} /></div>}
        <div className="detail-meta">
          <span><b>{new Date(tw.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric', year: 'numeric' })}</b></span>
          <span><b>{fmt(tw.retweet_count)}</b> Retweets</span>
          <span><b>{fmt(tw.like_count)}</b> Likes</span>
        </div>
        <div className="detail-actions">
          <button className="act reply"><span className="ico-wrap"><Icon name="reply" /></span></button>
          <button className="act rt" data-on={tw.retweeted_by_me ? '1' : '0'} onClick={rt}><span className="ico-wrap"><Icon name="rt" /></span></button>
          <button className="act like" data-on={tw.liked_by_me ? '1' : '0'} onClick={like}><span className="ico-wrap"><Icon name="heart" fill={tw.liked_by_me} /></span></button>
          <button className="act share"><span className="ico-wrap"><Icon name="share" /></span></button>
        </div>
      </div>
      <Compose key={tw.id} currentUser={currentUser} onPost={postReply} placeholder="Tweet your reply…" replying autoFocus />
      <div className="replies-head">{comments ? comments.length : 0} {comments && comments.length === 1 ? 'reply' : 'replies'}</div>
      <div className="feed-list">
        {comments === null ? <div className="empty">Loading replies…</div>
          : comments.length === 0 ? <div className="empty">No replies yet — be the first.</div>
            : comments.map((c) => <ReplyRow key={c.id} c={c} currentUser={currentUser} onDelete={delReply} onOpenProfile={(h) => go('profile', h)} go={go} />)}
      </div>
    </div>
  );
}

function ProfileScreen({ username, currentUser, cards, handlers, go }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('tweets');
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  async function load() {
    try {
      const d = await apiGetProfile(username);
      setData(d);
      setFollowing(!!d.user.is_following);
      setFollowers(d.user.follower_count || 0);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { setData(null); setErr(''); setTab('tweets'); load(); }, [username]);

  const localHandlers = { ...handlers, onOpenProfile: (h) => go('profile', h) };

  if (err) return <div className="feed-col"><div className="col-head"><button className="iconbtn back-btn" onClick={() => go('feed')}><Icon name="back" /></button><h1>Profile</h1></div><div className="empty">{err}</div></div>;
  if (!data) return <div className="feed-col"><div className="col-head"><h1>Profile</h1></div><div className="empty">Loading…</div></div>;

  const u = data.user;
  const isMe = currentUser && currentUser.username === u.username;
  const name = u.display_name || u.username;
  async function toggleFollow() {
    const on = !following;
    setFollowing(on); setFollowers((c) => c + (on ? 1 : -1));
    try { on ? await apiFollow(u.username) : await apiUnfollow(u.username); }
    catch (e) { alert(e.message); setFollowing(!on); setFollowers((c) => c + (on ? -1 : 1)); }
  }
  const bannerStyle = u.banner_url
    ? { backgroundImage: `url(${u.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: 'linear-gradient(120deg, var(--accent), var(--accent-2) 60%, var(--accent))' };

  return (
    <div className="feed-col">
      <div className="col-head">
        <button className="iconbtn back-btn" onClick={() => go('feed')} aria-label="Back"><Icon name="back" /></button>
        <div><h1>{name}</h1><div className="sub">{data.posts.length} posts</div></div>
      </div>
      <div className="banner" style={bannerStyle}></div>
      <div className="profile-bar">
        <div className="profile-avatar"><Avatar user={u} size={104} /></div>
        {isMe
          ? <button className="edit-btn" onClick={() => go('settings')}>Edit profile</button>
          : <button className="edit-btn" style={following ? {} : { background: 'var(--text)', color: 'var(--bg)', borderColor: 'transparent' }} onClick={toggleFollow}>{following ? 'Following' : 'Follow'}</button>}
      </div>
      <div className="profile-info">
        <div className="nm">{name}</div>
        <div className="hd">@{u.username}</div>
        {u.bio && <p className="bio">{u.bio}</p>}
        <div className="meta"><span><Icon name="cal" /> Joined {new Date(u.created_at).toLocaleDateString([], { month: 'long', year: 'numeric' })}</span></div>
        <div className="profile-stats"><span><b>{fmt(u.following_count || 0)}</b> Following</span><span><b>{fmt(followers)}</b> Followers</span></div>
      </div>
      <div className="profile-tabs">
        <button className="p-tab" data-active={tab === 'tweets' ? '1' : '0'} onClick={() => setTab('tweets')}>Tweets</button>
        <button className="p-tab" data-active={tab === 'likes' ? '1' : '0'} onClick={() => setTab('likes')}>Likes</button>
      </div>
      <div className={'feed-list' + (cards ? ' cards' : '')}>
        {tab === 'likes' ? (
          <div className="empty"><div className="big">♥</div>Liked tweets are private for now.</div>
        ) : data.posts.length ? (
          data.posts.map((t) => (
            <React.Fragment key={(t.retweeted_by || 'orig') + '-' + t.id}>
              {t.retweeted_by && <div className="retweet-tag" style={{ paddingTop: 'var(--pad)' }}><Icon name="rt" /> {t.retweeted_by} retweeted</div>}
              <Tweet tweet={t} currentUser={currentUser} isCard={cards} go={go} {...localHandlers} onLike={(tw) => handlers.onLike(tw, load)} onRt={(tw) => handlers.onRt(tw, load)} onDelete={(id) => handlers.onDelete(id, load)} />
            </React.Fragment>
          ))
        ) : (
          <div className="empty"><div className="big">🪶</div>Nothing here yet.</div>
        )}
      </div>
    </div>
  );
}

function Match({ m }) {
  const cls = m.status === 'IN_PLAY' || m.status === 'PAUSED' ? 'live' : m.status === 'FINISHED' ? 'ft' : 'up';
  const hasScore = m.homeScore != null && m.awayScore != null;
  const aWin = hasScore && m.homeScore > m.awayScore;
  const bWin = hasScore && m.awayScore > m.homeScore;
  const time = new Date(m.utcDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const crest = (t) => t.crest ? <img className="crest" src={t.crest} alt="" /> : <span className="flag">⚽</span>;
  return (
    <div className="match">
      <div className="match-top">
        <span>{(m.group || m.stage || '').replace(/_/g, ' ')}</span>
        <span className={'match-status ' + cls}>
          {cls === 'live' && <span className="live-dot"></span>}
          {cls === 'live' ? 'LIVE' : cls === 'ft' ? 'FULL TIME' : time}
        </span>
      </div>
      <div className="team-row">
        {crest(m.home)}
        <span className={'tname' + (aWin ? ' win' : '')}>{m.home.name}</span>
        <span className={'score' + (m.homeScore == null ? ' dim' : '')}>{m.homeScore == null ? '–' : m.homeScore}</span>
      </div>
      <div className="team-row">
        {crest(m.away)}
        <span className={'tname' + (bWin ? ' win' : '')}>{m.away.name}</span>
        <span className={'score' + (m.awayScore == null ? ' dim' : '')}>{m.awayScore == null ? '–' : m.awayScore}</span>
      </div>
    </div>
  );
}

function StandingsTable({ group }) {
  return (
    <>
      <div className="section-label">{(group.group || group.stage || 'Table').replace(/_/g, ' ')}</div>
      <div className="standings">
        <table>
          <thead><tr><th className="team-h" colSpan="2">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>
            {group.table.map((r, i) => (
              <tr key={r.team + i} className={i < 2 ? 'qual' : ''}>
                <td className="pos">{r.position || i + 1}</td>
                <td className="team-c">{r.crest ? <img className="crest" src={r.crest} alt="" /> : null}{r.team}</td>
                <td>{r.played}</td><td>{r.won}</td><td>{r.draw}</td><td>{r.lost}</td>
                <td>{r.gd > 0 ? '+' : ''}{r.gd}</td><td className="pts">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SportsScreen() {
  const [seg, setSeg] = useState('matches');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { setData(null); setErr(''); apiGetSports(seg).then(setData).catch((e) => setErr(e.message)); }, [seg]);

  let body;
  if (err) body = <div className="empty">{err}</div>;
  else if (!data) body = <div className="empty">Loading live data…</div>;
  else if (data.configured === false) body = (
    <div className="sports-setup">
      <div className="big">🔑</div>
      <h3>Almost there</h3>
      <p className="muted">Live World Cup data needs a free API key. Get one at football-data.org, set <code>FOOTBALL_DATA_API_KEY</code>, and redeploy.</p>
    </div>
  );
  else if (data.error) body = <div className="empty">{data.error}</div>;
  else if (seg === 'matches') {
    const ms = data.matches || [];
    const live = ms.filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED');
    const ft = ms.filter((m) => m.status === 'FINISHED');
    const up = ms.filter((m) => m.status === 'TIMED' || m.status === 'SCHEDULED');
    body = (
      <>
        {live.length > 0 && <div className="section-label"><span className="live-dot"></span> Live now</div>}
        {live.map((m) => <Match key={m.id} m={m} />)}
        {ft.length > 0 && <div className="section-label">Full time</div>}
        {ft.slice(0, 20).map((m) => <Match key={m.id} m={m} />)}
        {up.length > 0 && <div className="section-label">Upcoming</div>}
        {up.slice(0, 20).map((m) => <Match key={m.id} m={m} />)}
        {ms.length === 0 && <div className="empty">No matches available right now.</div>}
      </>
    );
  } else {
    const groups = data.groups || [];
    body = groups.length ? (<>{groups.map((g, i) => <StandingsTable key={(g.group || g.stage || 'tbl') + '-' + i} group={g} />)}<div className="section-label" style={{ paddingTop: 22 }}>Top two of each group advance · <span style={{ color: 'var(--rt)' }}>green = qualifying</span></div></>) : <div className="empty">No standings available yet.</div>;
  }

  return (
    <div className="feed-col">
      <div className="col-head"><div><h1>Sports</h1><div className="sub">World Cup 2026</div></div></div>
      <div className="sports">
        <div className="sports-hero">
          <span className="ball">⚽</span>
          <div className="kicker">FIFA World Cup · USA · Canada · Mexico</div>
          <h2>World Cup 2026</h2>
          <p>Live scores and group standings</p>
        </div>
        <div className="seg-tabs">
          <button className="seg-tab" data-active={seg === 'matches' ? '1' : '0'} onClick={() => setSeg('matches')}>Matches</button>
          <button className="seg-tab" data-active={seg === 'standings' ? '1' : '0'} onClick={() => setSeg('standings')}>Standings</button>
        </div>
        {body}
      </div>
    </div>
  );
}

function SearchScreen({ initialQuery, currentUser, cards, handlers, go }) {
  const [q, setQ] = useState(initialQuery || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (initialQuery != null) setQ(initialQuery); }, [initialQuery]);

  async function runSearch(term) {
    const t = (term != null ? term : q).trim();
    if (!t) { setData(null); return; }
    setLoading(true);
    try { setData(await apiSearch(t)); } catch (e) { console.error(e); } finally { setLoading(false); }
  }
  // Debounced search-as-you-type.
  useEffect(() => {
    const term = q.trim();
    if (!term) { setData(null); return; }
    const tid = setTimeout(() => runSearch(term), 300);
    return () => clearTimeout(tid);
  }, [q]);

  const reload = () => runSearch();
  const th = {
    onOpen: handlers.onOpen,
    onShare: handlers.onShare,
    onLike: (tw) => handlers.onLike(tw, reload),
    onRt: (tw) => handlers.onRt(tw, reload),
    onDelete: (id) => handlers.onDelete(id, reload),
  };

  return (
    <div className="feed-col">
      <div className="col-head"><div><h1>Search</h1></div></div>
      <div className="search" style={{ margin: 'var(--pad)' }}>
        <Icon name="search" />
        <input autoFocus value={q} placeholder="Search people and tweets" onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading && <div className="empty">Searching…</div>}
      {!loading && !data && <div className="empty">Find people (name or @handle) and tweets — try a #hashtag.</div>}
      {!loading && data && (
        <>
          {data.users.length > 0 && <div className="section-label">People</div>}
          {data.users.map((u) => (
            <div className="who" key={u.username} style={{ cursor: 'pointer', padding: '10px var(--pad)' }} onClick={() => go('profile', u.username)}>
              <Avatar user={u} size={44} />
              <div className="info"><div className="n">{u.display_name || u.username}</div><div className="h">@{u.username}</div></div>
            </div>
          ))}
          {data.posts.length > 0 && <div className="section-label">Tweets</div>}
          <div className={'feed-list' + (cards ? ' cards' : '')}>
            {data.posts.map((t) => (
              <Tweet key={t.id} tweet={t} currentUser={currentUser} isCard={cards} go={go} onOpenProfile={(h) => go('profile', h)} {...th} />
            ))}
          </div>
          {data.users.length === 0 && data.posts.length === 0 && <div className="empty">No results for "{q.trim()}".</div>}
        </>
      )}
    </div>
  );
}

function SettingsScreen({ currentUser, onSaved, onLogout, go }) {
  const [displayName, setDisplayName] = useState(currentUser.display_name || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || '');
  const [bannerUrl, setBannerUrl] = useState(currentUser.banner_url || '');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState('');

  async function upload(file, setter, which) {
    if (!file) return;
    setErr(''); setBusy(which);
    try { setter(await apiUploadImage(file)); } catch (e) { setErr(e.message); } finally { setBusy(''); }
  }
  async function save(e) {
    e.preventDefault(); setErr(''); setOk(false);
    try {
      const u = await apiUpdateProfile({ display_name: displayName.trim(), bio: bio.trim(), avatar_url: avatarUrl || null, banner_url: bannerUrl || null });
      onSaved(u); setOk(true);
    } catch (x) { setErr(x.message); }
  }
  const preview = { username: currentUser.username, display_name: displayName, avatar_url: avatarUrl };

  return (
    <div className="feed-col">
      <div className="col-head">
        <button className="iconbtn back-btn" onClick={() => go('feed')} aria-label="Back"><Icon name="back" /></button>
        <div><h1>Settings</h1></div>
      </div>
      <form className="settings-body" onSubmit={save}>
        <label>Display name</label>
        <input className="field" maxLength={50} value={displayName} placeholder="e.g. Ada Lovelace" onChange={(e) => setDisplayName(e.target.value)} />

        <label>Bio</label>
        <textarea className="field" maxLength={160} value={bio} placeholder="A short something about you…" onChange={(e) => setBio(e.target.value)} />

        <label>Profile photo</label>
        <div className="set-row">
          <Avatar user={preview} size={64} />
          <label className="ghost-btn upload-label">{busy === 'avatar' ? 'Uploading…' : 'Upload photo'}<input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files[0], setAvatarUrl, 'avatar')} /></label>
          {avatarUrl && <button type="button" className="ghost-btn" onClick={() => setAvatarUrl('')}>Remove</button>}
        </div>

        <label>Banner</label>
        <div className="set-banner" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : {}}></div>
        <div className="set-row">
          <label className="ghost-btn upload-label">{busy === 'banner' ? 'Uploading…' : 'Upload banner'}<input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files[0], setBannerUrl, 'banner')} /></label>
          {bannerUrl && <button type="button" className="ghost-btn" onClick={() => setBannerUrl('')}>Remove</button>}
        </div>

        {err && <div className="form-err">{err}</div>}
        {ok && <div className="form-ok">Saved! ✨</div>}
        <div className="set-row" style={{ marginTop: 18 }}>
          <button className="post-btn" type="submit" disabled={!!busy}>Save changes</button>
          <button className="ghost-btn" type="button" onClick={onLogout}>Log out</button>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>Tip: tap the 🎨 button (bottom-right) to switch between the 8 themes and layouts.</p>
      </form>
    </div>
  );
}

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { onAuthed(mode === 'login' ? await apiLogin(username, password) : await apiSignup(username, password)); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <div className="auth-stage">
      <div className="auth-card">
        <div className="brand">
          <div className="brand-mark">b</div>
          <div className="brand-word">boon<b>tweet</b></div>
        </div>
        <div className="auth-tabs">
          <button data-active={mode === 'login' ? '1' : '0'} onClick={() => setMode('login')}>Log in</button>
          <button data-active={mode === 'signup' ? '1' : '0'} onClick={() => setMode('signup')}>Sign up</button>
        </div>
        <form onSubmit={submit}>
          <input className="field" placeholder="username" value={username} autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
          <input className="field" type="password" placeholder="password" value={password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onChange={(e) => setPassword(e.target.value)} />
          {err && <div className="form-err">{err}</div>}
          <button className="btn-primary" type="submit" disabled={busy}>{mode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
      </div>
    </div>
  );
}

// ---- App controller ----
const TWEAK_KEY = 'boontweet_tweaks';
const DEFAULT_TWEAKS = { theme: 'neon', accent: '#22d3ee', font: '', nav: 'sidebar', cards: 'glassy', density: 'spacious' };
function loadTweaks() { try { return JSON.parse(localStorage.getItem(TWEAK_KEY)); } catch (e) { return null; } }

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState({ name: 'feed', params: null });
  const [toast, setToast] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scope, setScope] = useState('all'); // 'all' (For you) or 'following'
  const [tweaks, setTweaks] = useState(() => ({ ...DEFAULT_TWEAKS, ...(loadTweaks() || {}) }));
  const savedRef = useRef(loadTweaks());
  const toastTimer = useRef();

  const flash = (msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1600); };

  const PAGE = 20;
  async function reloadFeed(sc = scope) {
    const data = await apiGetFeed(null, sc);
    setPosts(data);
    setCursor(data.length ? data[data.length - 1].sort_time : null);
    setHasMore(data.length >= PAGE);
  }
  async function loadMore() {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const data = await apiGetFeed(cursor, scope);
      setPosts((ps) => [...ps, ...data]);
      setCursor(data.length ? data[data.length - 1].sort_time : cursor);
      setHasMore(data.length >= PAGE);
    } catch (e) { console.error(e); } finally { setLoadingMore(false); }
  }
  function switchScope(sc) { if (sc === scope) return; setScope(sc); reloadFeed(sc); }
  function patchPosts(id, fn) { setPosts((ps) => ps.map((p) => (p.id === id ? fn(p) : p))); }

  useEffect(() => {
    (async () => {
      try {
        const user = await apiGetCurrentUser();
        setCurrentUser(user);
        if (user) {
          // DB is the source of truth for theme. If the user has no saved
          // local tweaks yet, snap all knobs to their theme's defaults.
          if (user.theme && THEME_BY_ID[user.theme]) {
            if (savedRef.current) setTweaks((t) => ({ ...t, theme: user.theme }));
            else { const th = THEME_BY_ID[user.theme]; setTweaks({ theme: th.id, accent: th.accent, font: '', nav: th.nav, cards: th.card, density: th.density }); }
          }
          await reloadFeed();
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);

  function persistTweaks(next) { setTweaks(next); try { localStorage.setItem(TWEAK_KEY, JSON.stringify(next)); } catch (e) {} }
  async function saveThemeToDb(theme) { if (USE_FAKE_DATA || !currentUser) return; try { setCurrentUser(await apiUpdateProfile({ theme })); } catch (e) {} }
  function setTweak(key, val) { const next = { ...tweaks, [key]: val }; persistTweaks(next); if (key === 'theme') saveThemeToDb(val); }
  function pickTheme(id) { const th = THEME_BY_ID[id]; persistTweaks({ theme: id, accent: th.accent, font: '', nav: th.nav, cards: th.card, density: th.density }); saveThemeToDb(id); }

  function go(name, params = null) { setRoute({ name, params }); window.scrollTo({ top: 0 }); }
  const openTweet = (tw) => go('detail', tw);
  async function handleLogout() { await apiLogout(); setCurrentUser(null); setRoute({ name: 'feed' }); setPosts([]); }

  const onShare = () => { try { navigator.clipboard && navigator.clipboard.writeText(window.location.href); } catch (e) {} flash('Link copied'); };

  // Generic handlers used by the Profile screen (it passes its own reload fn).
  const genLike = async (tw, reload) => { try { tw.liked_by_me ? await apiUnlike(tw.id) : await apiLike(tw.id); } catch (e) { alert(e.message); } reload && reload(); };
  const genRt = async (tw, reload) => { const was = tw.retweeted_by_me; try { was ? await apiUnretweet(tw.id) : await apiRetweet(tw.id); } catch (e) { alert(e.message); return; } flash(was ? 'Removed retweet' : 'Retweeted to your followers'); reload && reload(); };
  const genDelete = async (id, reload) => { if (!confirm('Delete this tweet?')) return; try { await apiDeletePost(id); } catch (e) { alert(e.message); return; } flash('Tweet deleted'); reload && reload(); };
  const genHandlers = { onOpen: openTweet, onLike: genLike, onRt: genRt, onDelete: genDelete, onShare };

  // Feed handlers update the loaded pages IN PLACE so paging/scroll survive a
  // like; they reload only when the feed's structure changes (retweet).
  const feedLike = async (tw) => {
    const on = !tw.liked_by_me;
    patchPosts(tw.id, (p) => ({ ...p, liked_by_me: on, like_count: p.like_count + (on ? 1 : -1) }));
    try { on ? await apiLike(tw.id) : await apiUnlike(tw.id); }
    catch (e) { alert(e.message); patchPosts(tw.id, (p) => ({ ...p, liked_by_me: !on, like_count: p.like_count + (on ? -1 : 1) })); }
  };
  const feedRt = async (tw) => { const was = tw.retweeted_by_me; try { was ? await apiUnretweet(tw.id) : await apiRetweet(tw.id); } catch (e) { alert(e.message); return; } flash(was ? 'Removed retweet' : 'Retweeted to your followers'); reloadFeed(); };
  const feedDelete = async (id) => { if (!confirm('Delete this tweet?')) return; try { await apiDeletePost(id); } catch (e) { alert(e.message); return; } flash('Tweet deleted'); setPosts((ps) => ps.filter((p) => p.id !== id)); };
  const postTweet = async ({ text, imageUrl }) => { let p; try { p = await apiCreatePost(text, imageUrl); } catch (e) { alert(e.message); return; } flash('Your tweet was posted'); setPosts((ps) => [p, ...ps]); };
  const feedHandlers = { onOpen: openTweet, onLike: feedLike, onRt: feedRt, onDelete: feedDelete, onShare };

  const cards = tweaks.cards !== 'rows';

  // Apply theme + layout to <html> (NOT an inner div). CSS custom properties
  // only cascade downward, so the themed vars must live at/above <body> for
  // style.css's `body { background/color/font: var(...) }` rules to pick up the
  // active theme. Putting them on an inner wrapper would leave body on the
  // :root defaults (illegible text + wrong font/background on light themes).
  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute('data-theme', tweaks.theme);
    r.setAttribute('data-nav', tweaks.nav);
    r.setAttribute('data-density', tweaks.density);
    r.setAttribute('data-card', tweaks.cards);
    r.style.setProperty('--accent', tweaks.accent);
    if (tweaks.font) r.style.setProperty('--font', tweaks.font);
    else r.style.removeProperty('--font');
    // Keep gradients coherent: a CUSTOM accent also retints the secondary, but
    // a theme's default accent keeps the theme's own --accent-2 (e.g. neon's
    // cyan→magenta).
    const themeAccent = (THEME_BY_ID[tweaks.theme] || {}).accent;
    if (tweaks.accent && tweaks.accent !== themeAccent) r.style.setProperty('--accent-2', tweaks.accent);
    else r.style.removeProperty('--accent-2');
  }, [tweaks]);

  // wrap() pairs the current screen with the floating Appearance panel (the
  // panel shows even logged-out so you can preview themes on the login screen).
  const wrap = (inner) => (
    <>
      {inner}
      {!loading && <AppearancePanel tweaks={tweaks} onPick={pickTheme} onSet={setTweak} />}
    </>
  );

  if (loading) return wrap(<div className="auth-stage"><div className="empty">Loading…</div></div>);
  if (!currentUser) return wrap(<AuthScreen onAuthed={(u) => { setCurrentUser(u); reloadFeed(); }} />);

  let screen;
  if (route.name === 'detail' && route.params) {
    screen = <TweetDetailScreen tweet={route.params} currentUser={currentUser} cards={cards} onBack={() => go('feed')} onChanged={reloadFeed} go={go} />;
  } else if (route.name === 'sports') {
    screen = <SportsScreen />;
  } else if (route.name === 'search') {
    screen = <SearchScreen initialQuery={route.params} currentUser={currentUser} cards={cards} handlers={genHandlers} go={go} />;
  } else if (route.name === 'settings') {
    screen = <SettingsScreen currentUser={currentUser} onSaved={(u) => { setCurrentUser(u); flash('Profile saved'); }} onLogout={handleLogout} go={go} />;
  } else if (route.name === 'profile') {
    screen = <ProfileScreen username={route.params || currentUser.username} currentUser={currentUser} cards={cards} handlers={genHandlers} go={go} />;
  } else {
    screen = <FeedScreen posts={posts} currentUser={currentUser} cards={cards} onPost={postTweet} handlers={feedHandlers} go={go} onLoadMore={loadMore} hasMore={hasMore} loadingMore={loadingMore} scope={scope} onScope={switchScope} />;
  }

  return wrap(
    <div className="stage">
      <div className="app">
        <Sidebar route={route} currentUser={currentUser} go={go} onCompose={() => go('feed')} onLogout={handleLogout} />
        <TopNav route={route} currentUser={currentUser} go={go} />
        {screen}
        <Aside go={go} />
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
