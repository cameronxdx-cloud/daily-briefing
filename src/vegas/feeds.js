import { XMLParser } from "fast-xml-parser";
import { SOURCES, VEGAS_KEYWORDS } from "./sources.js";

const MAX_AGE_HOURS = 36;
const MAX_PER_SOURCE = 12;
const FETCH_TIMEOUT_MS = 15_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  cdataPropName: false,
  processEntities: true,
  htmlEntities: true,
});

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = (v) => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  return text(v["#text"] ?? v["@href"] ?? "");
};

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
export function cleanText(s, maxLen = 0) {
  let out = String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
  if (maxLen && out.length > maxLen) out = out.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
  return out;
}

function findImage(item) {
  const candidates = [
    ...asArray(item["media:content"]),
    ...asArray(item["media:thumbnail"]),
    ...asArray(item["media:group"]?.["media:content"]),
    ...asArray(item.enclosure),
  ];
  for (const c of candidates) {
    const url = c?.["@url"];
    const type = c?.["@type"] ?? c?.["@medium"] ?? "image";
    if (url && /image/i.test(type)) return url;
  }
  const html = text(item["content:encoded"]) || text(item.description);
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
}

// Normalize RSS 2.0 <item> and Atom <entry> into one shape.
export function parseFeed(xml, source) {
  const doc = parser.parse(xml);
  const rawItems = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.["rdf:RDF"]?.item;

  return asArray(rawItems).map((item) => {
    let title = cleanText(text(item.title));
    let outlet = source.name;

    // Google News titles look like "Headline - Outlet"; keep the real outlet.
    const gnSource = text(item.source);
    if (gnSource) {
      outlet = cleanText(gnSource);
      const suffix = ` - ${outlet}`;
      if (title.endsWith(suffix)) title = title.slice(0, -suffix.length);
    }

    const linkField = asArray(item.link).find((l) => !l?.["@rel"] || l["@rel"] === "alternate") ?? item.link;
    const link = text(linkField) || text(item.guid);
    const dateStr = text(item.pubDate) || text(item.published) || text(item.updated) || text(item["dc:date"]);
    const published = dateStr ? new Date(dateStr) : null;

    // Google News descriptions are just a link list — skip them.
    const summary = gnSource ? "" : cleanText(text(item.description) || text(item.summary), 280);

    return {
      title,
      link,
      summary,
      image: findImage(item),
      outlet,
      kind: source.kind,
      published: published && !isNaN(published) ? published.toISOString() : null,
    };
  }).filter((i) => i.title && i.link);
}

async function fetchSource(source) {
  const res = await fetch(source.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; VegasNewsBrief/1.0)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseFeed(await res.text(), source);
}

const normTitle = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter((w) => w.length > 2);
function isDuplicate(a, b) {
  const wa = new Set(normTitle(a.title));
  const wb = new Set(normTitle(b.title));
  if (!wa.size || !wb.size) return false;
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.min(wa.size, wb.size) >= 0.7;
}

export function mentionsVegas(item) {
  const hay = ` ${item.title} ${item.summary} `.toLowerCase();
  return VEGAS_KEYWORDS.some((k) => new RegExp(`\\b${k}\\b`).test(hay));
}

// Fetch every source, drop old/duplicate stories, and sort into sections.
export async function collectNews({ sources = SOURCES, now = new Date() } = {}) {
  const results = await Promise.allSettled(sources.map(fetchSource));
  const status = [];
  let all = [];

  results.forEach((r, i) => {
    const src = sources[i];
    if (r.status === "fulfilled") {
      status.push({ name: src.name, ok: true, count: r.value.length });
      all.push(...r.value.slice(0, MAX_PER_SOURCE * 2));
    } else {
      status.push({ name: src.name, ok: false, error: r.reason?.message ?? String(r.reason) });
    }
  });

  const cutoff = now.getTime() - MAX_AGE_HOURS * 3600_000;
  all = all
    .filter((i) => !i.published || new Date(i.published).getTime() >= cutoff)
    .sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""));

  const unique = [];
  for (const item of all) {
    if (!unique.some((u) => u.link === item.link || isDuplicate(u, item))) unique.push(item);
  }

  const perOutlet = {};
  const capped = unique.filter((i) => (perOutlet[i.outlet] = (perOutlet[i.outlet] ?? 0) + 1) <= MAX_PER_SOURCE);

  const local = capped.filter((i) => i.kind === "local");
  const vegasNational = capped.filter((i) => i.kind === "national" && mentionsVegas(i));
  const national = capped.filter((i) => i.kind === "national" && !mentionsVegas(i));

  return {
    generatedAt: now.toISOString(),
    sections: {
      local: local.slice(0, 30),
      vegasNational: vegasNational.slice(0, 12),
      national: national.slice(0, 24),
    },
    status,
  };
}
