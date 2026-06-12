// ===========================================================================
// routes/explore.js — News + Videos for the Explore tab.
// ===========================================================================
// Both pull from FREE public RSS feeds, server-side (no API key):
//   - News:   Google News RSS (topic feeds)
//   - Videos: YouTube channel RSS (latest uploads from a few channels)
// Responses are cached in memory so we don't hammer the feeds.
// ===========================================================================

const express = require('express');
const { XMLParser } = require('fast-xml-parser');

const router = express.Router();
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// Tiny TTL cache shared by both endpoints.
const cache = {};
async function cached(key, ttlMs, fn) {
  const now = Date.now();
  if (cache[key] && cache[key].exp > now) return cache[key].data;
  const data = await fn();
  cache[key] = { data, exp: now + ttlMs };
  return data;
}
// XML nodes are a single object when there's one child, an array when many.
const asArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);

// ---------------------------------------------------------------------------
// News — Google News RSS
// ---------------------------------------------------------------------------
const NEWS_TOPICS = {
  top: '', world: 'WORLD', tech: 'TECHNOLOGY', sports: 'SPORTS',
  business: 'BUSINESS', science: 'SCIENCE', health: 'HEALTH', entertainment: 'ENTERTAINMENT',
};
function newsUrl(topicKey) {
  const t = NEWS_TOPICS[topicKey] || '';
  const tail = 'hl=en-US&gl=US&ceid=US:en';
  return t
    ? `https://news.google.com/rss/headlines/section/topic/${t}?${tail}`
    : `https://news.google.com/rss?${tail}`;
}
router.get('/news', async (req, res) => {
  const topic = NEWS_TOPICS[(req.query.topic || '').toLowerCase()] !== undefined ? req.query.topic.toLowerCase() : 'top';
  try {
    const items = await cached('news:' + topic, 10 * 60 * 1000, async () => {
      const r = await fetch(newsUrl(topic), { headers: { 'User-Agent': 'BoonTweet/1.0' } });
      if (!r.ok) throw new Error('news upstream ' + r.status);
      const doc = parser.parse(await r.text());
      const raw = asArray(doc && doc.rss && doc.rss.channel && doc.rss.channel.item);
      return raw.slice(0, 25).map((it) => {
        const source = (it.source && (it.source['#text'] || it.source)) || '';
        let title = String(it.title || '');
        if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(String(source).length + 3));
        return { title, source: String(source || ''), link: String(it.link || ''), pubDate: it.pubDate || null };
      }).filter((x) => x.title && x.link);
    });
    res.json({ topic, items });
  } catch (err) {
    res.json({ topic, error: 'Could not load news right now.' });
  }
});

// ---------------------------------------------------------------------------
// Videos — YouTube channel RSS (latest uploads, merged + newest first)
// ---------------------------------------------------------------------------
const CHANNELS = [
  { id: 'UCsXVk37bltHxD1rDPwtNM8Q', label: 'Kurzgesagt' },
  { id: 'UCHnyfMqiRRG1u-2MsSQLbXA', label: 'Veritasium' },
  { id: 'UCAuUUnT6oDeKwE6v1NGQxug', label: 'TED' },
  { id: 'UCLA_DiR1FfKNvjuUpBHmylQ', label: 'NASA' },
  { id: 'UCpVm7bg6pXKo1Pr6k5kxG9A', label: 'National Geographic' },
  { id: 'UCO8DQrSp5yEP937qNqTooOw', label: 'FIFA' },
];
async function fetchChannel(ch) {
  try {
    const r = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + ch.id);
    if (!r.ok) return [];
    const doc = parser.parse(await r.text());
    return asArray(doc && doc.feed && doc.feed.entry).slice(0, 6).map((e) => ({
      videoId: e['yt:videoId'],
      title: String(e.title || ''),
      channel: (e.author && e.author.name) || ch.label,
      published: e.published || null,
    })).filter((v) => v.videoId);
  } catch (e) {
    return [];
  }
}
router.get('/videos', async (req, res) => {
  try {
    const videos = await cached('videos', 30 * 60 * 1000, async () => {
      const lists = await Promise.all(CHANNELS.map(fetchChannel));
      const merged = [].concat(...lists);
      merged.sort((a, b) => new Date(b.published) - new Date(a.published));
      return merged.slice(0, 24);
    });
    res.json({ videos });
  } catch (err) {
    res.json({ error: 'Could not load videos right now.' });
  }
});

module.exports = router;
