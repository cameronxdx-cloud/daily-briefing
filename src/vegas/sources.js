// News sources for the Las Vegas news app.
//
// kind: "local"    → Las Vegas / Nevada outlets (every story is relevant)
//       "national" → CNN and other major outlets (top U.S./world stories,
//                    plus any story that mentions Las Vegas gets pulled into
//                    the "Vegas in the national news" section)
//
// A few outlets don't publish a dependable RSS feed, so they are read through
// a Google News search scoped to their domain (googleNews() below).

const googleNews = (query) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

export const SOURCES = [
  // ── Local: Las Vegas & Nevada ───────────────────────────────────────────
  { name: "Las Vegas Review-Journal", kind: "local", url: "https://www.reviewjournal.com/feed/" },
  { name: "Las Vegas Sun",            kind: "local", url: "https://lasvegassun.com/feeds/headlines/all/" },
  { name: "8 News Now (KLAS)",        kind: "local", url: "https://www.8newsnow.com/feed/" },
  { name: "FOX5 Vegas (KVVU)",        kind: "local", url: "https://www.fox5vegas.com/arc/outboundfeeds/rss/?outputType=xml" },
  { name: "KTNV 13 Action News",      kind: "local", url: googleNews("site:ktnv.com when:2d") },
  { name: "News 3 Las Vegas (KSNV)",  kind: "local", url: googleNews("site:news3lv.com when:2d") },
  { name: "Nevada Public Radio",      kind: "local", url: googleNews("site:knpr.org when:2d") },
  { name: "The Nevada Independent",   kind: "local", url: "https://thenevadaindependent.com/feed" },
  { name: "Nevada Current",           kind: "local", url: "https://nevadacurrent.com/feed/" },

  // ── National: CNN + major outlets ──────────────────────────────────────
  { name: "CNN",           kind: "national", url: "http://rss.cnn.com/rss/cnn_topstories.rss" },
  { name: "CNN",           kind: "national", url: "http://rss.cnn.com/rss/cnn_us.rss" },
  { name: "CNN",           kind: "national", url: googleNews("site:cnn.com when:1d") },
  { name: "Associated Press", kind: "national", url: googleNews("site:apnews.com when:1d") },
  { name: "NPR",           kind: "national", url: "https://feeds.npr.org/1001/rss.xml" },
  { name: "NBC News",      kind: "national", url: "https://feeds.nbcnews.com/nbcnews/public/news" },
  { name: "ABC News",      kind: "national", url: "https://abcnews.go.com/abcnews/topstories" },
  { name: "CBS News",      kind: "national", url: "https://www.cbsnews.com/latest/rss/main" },
  { name: "Fox News",      kind: "national", url: "https://moxie.foxnews.com/google-publisher/latest.xml" },
  { name: "New York Times", kind: "national", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" },
  { name: "BBC News",      kind: "national", url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml" },

  // Any major outlet writing about Las Vegas right now.
  { name: "Google News",   kind: "national", url: googleNews('"Las Vegas" when:1d') },
];

// A national story mentioning any of these is surfaced as Vegas news.
export const VEGAS_KEYWORDS = [
  "las vegas", "vegas", "henderson", "north las vegas", "summerlin",
  "clark county", "nevada", "reno", "lake mead", "the strip", "unlv",
  "raiders", "golden knights", "harry reid airport", "lvmpd",
];
