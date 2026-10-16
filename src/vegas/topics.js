// Sorts stories into topics so the page can be browsed by subject.
// Keyword matching keeps it free and predictable; a story goes to the topic
// with the most keyword hits, and ties go to the topic listed first.

export const TOPICS = [
  { id: "safety",   label: "Crime & Safety", emoji: "🚨", words: ["police", "lvmpd", "metro police", "shooting", "shot", "killed", "homicide", "murder", "robbery", "stabbing", "arrest", "arrested", "suspect", "charged", "sentenced", "jail", "detention", "missing", "body found", "fire", "firefighters", "investigation", "victim", "dui"] },
  { id: "traffic",  label: "Traffic & Travel", emoji: "🚗", words: ["crash", "wrong-way", "traffic", "i-15", "i-11", "us 95", "freeway", "highway", "road", "roads", "closure", "closures", "lanes", "construction", "rtc", "bus", "pedestrian", "airport", "harry reid", "flight", "flights", "airline", "brightline", "monorail", "loop"] },
  { id: "politics", label: "Government", emoji: "🏛️", words: ["council", "commission", "commissioners", "county", "governor", "lombardo", "legislature", "lawmakers", "bill", "election", "ballot", "vote", "voters", "supreme court", "mayor", "ordinance", "law", "tax", "budget", "congress", "senator", "rosen", "cortez masto", "secretary of state", "attorney general", "records"] },
  { id: "strip",    label: "Strip & Business", emoji: "🎰", words: ["casino", "casinos", "resort", "strip", "hotel", "mgm", "caesars", "wynn", "venetian", "sphere", "fontainebleau", "resorts world", "jobs", "economy", "business", "restaurant", "opening", "opens", "tourism", "visitors", "convention", "real estate", "housing", "home prices", "rent", "development", "concert", "residency", "show", "entertainment", "gaming"] },
  { id: "sports",   label: "Sports", emoji: "🏈", words: ["raiders", "golden knights", "aces", "nfl", "nhl", "wnba", "mlb", "athletics", "coach", "quarterback", "stadium", "allegiant", "t-mobile arena", "f1", "grand prix", "boxing", "ufc", "playoff", "playoffs", "season", "game", "rebels football", "lights fc", "aviators", "sports"] },
  { id: "weather",  label: "Weather & Environment", emoji: "☀️", words: ["weather", "heat", "rain", "storm", "storms", "wind", "flood", "flooding", "temperature", "temperatures", "lake mead", "colorado river", "water", "drought", "wildfire", "air quality", "forecast", "monsoon", "cold"] },
  { id: "schools",  label: "Schools", emoji: "🎓", words: ["ccsd", "school", "schools", "student", "students", "teacher", "teachers", "education", "college", "university", "nsc", "csn", "campus"] },
];

export const LOCAL_FALLBACK = { id: "local", label: "More Local News", emoji: "📍" };
export const NATIONAL = { id: "national", label: "Nation & World", emoji: "🇺🇸" };

const PATTERNS = TOPICS.map((t) => ({
  id: t.id,
  re: t.words.map((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")),
}));

export function topicFor(item) {
  const text = `${item.title} ${item.title} ${item.summary}`.toLowerCase(); // title counts double
  let best = null;
  let bestScore = 0;
  for (const p of PATTERNS) {
    const score = p.re.reduce((n, re) => n + (text.match(re)?.length ?? 0), 0);
    if (score > bestScore) { best = p.id; bestScore = score; }
  }
  return best ?? LOCAL_FALLBACK.id;
}
