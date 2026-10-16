// Renders the news page as one self-contained static HTML file.
//
// Layout: today's brief → top stories → topic sections (cards) → a compact
// Nation & World list. Topic tabs and a search box filter the page in the
// browser; everything still reads fine with JavaScript off.

import { TOPICS, LOCAL_FALLBACK, NATIONAL, topicFor } from "./topics.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const safeUrl = (u) => (/^https?:\/\//i.test(u ?? "") ? u : null);

const timeLabel = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })
    : "";

const TOPIC_INFO = Object.fromEntries([...TOPICS, LOCAL_FALLBACK, NATIONAL].map((t) => [t.id, t]));

// WhatsApp-style *bold* / _italic_ / "• " bullets → HTML, one column per heading.
function briefToHtml(brief) {
  const inline = (s) => esc(s).replace(/\*([^*]+)\*/g, "<strong>$1</strong>").replace(/_([^_]+)_/g, "<em>$1</em>");
  const groups = [];
  let cur = null;
  for (const raw of brief.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[•\-–]\s*/.test(line)) {
      if (!cur) groups.push((cur = { title: "", items: [] }));
      cur.items.push(line.replace(/^[•\-–]\s*/, ""));
    } else {
      groups.push((cur = { title: line.replace(/^\*(.*)\*$/, "$1"), items: [] }));
    }
  }
  return `<div class="brief-cols">${groups
    .filter((g) => g.items.length)
    .map((g) => `<div>${g.title ? `<h3>${inline(g.title)}</h3>` : ""}<ul>${g.items.map((l) => `<li>${inline(l)}</li>`).join("")}</ul></div>`)
    .join("")}</div>`;
}

const searchText = (item) => `${item.title} ${item.summary} ${item.outlet} ${(item.alsoIn ?? []).join(" ")}`.toLowerCase();

function meta(item, { topic = false } = {}) {
  const t = TOPIC_INFO[item.topic];
  const also = item.alsoIn?.length ? `<span class="also" title="Also covered by ${esc(item.alsoIn.join(", "))}">+${item.alsoIn.length} more</span>` : "";
  return `<div class="meta">
      ${topic && t ? `<span class="chip-sm">${t.emoji} ${esc(t.label)}</span>` : ""}
      <span class="outlet">${esc(item.outlet)}</span>
      ${item.published ? `<time datetime="${esc(item.published)}">${esc(timeLabel(item.published))}</time>` : ""}
      ${also}
    </div>`;
}

function card(item, { size = "normal", showTopic = false } = {}) {
  const link = safeUrl(item.link) ?? "#";
  const img = safeUrl(item.image);
  return `
    <article class="card card-${size}${img ? "" : " no-img"}" data-topic="${esc(item.topic)}" data-search="${esc(searchText(item))}">
      ${img ? `<a class="thumb" href="${esc(link)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.card').classList.add('no-img');this.parentNode.remove()"></a>` : ""}
      <div class="card-body">
        ${meta(item, { topic: showTopic })}
        <h3><a href="${esc(link)}" target="_blank" rel="noopener">${esc(item.title)}</a></h3>
        ${item.summary && size !== "small" ? `<p>${esc(item.summary)}</p>` : ""}
      </div>
    </article>`;
}

function headlineRow(item) {
  const link = safeUrl(item.link) ?? "#";
  return `
    <li class="row" data-topic="${esc(item.topic)}" data-search="${esc(searchText(item))}">
      <a href="${esc(link)}" target="_blank" rel="noopener">${esc(item.title)}</a>
      ${meta(item)}
    </li>`;
}

// Stories several outlets covered, with photos, rank first.
function pickTopStories(items, n = 5) {
  const now = Date.now();
  const score = (i) =>
    (i.alsoIn?.length ?? 0) * 3 +
    (i.image ? 2 : 0) +
    (i.published ? Math.max(0, 6 - (now - Date.parse(i.published)) / 3600_000) / 2 : 0);
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, n);
}

export function renderPage({ news, brief, dateLabel }) {
  const { local, vegasNational, national } = news.sections;
  const vegas = [...local, ...vegasNational].map((i) => ({ ...i, topic: topicFor(i) }));
  const world = national.map((i) => ({ ...i, topic: NATIONAL.id }));

  const top = pickTopStories(vegas);
  const topLinks = new Set(top.map((i) => i.link));
  const rest = vegas.filter((i) => !topLinks.has(i.link));

  const groups = [...TOPICS, LOCAL_FALLBACK]
    .map((t) => ({ ...t, items: rest.filter((i) => i.topic === t.id) }))
    .filter((g) => g.items.length);

  const counts = Object.fromEntries([...TOPICS, LOCAL_FALLBACK].map((t) => [t.id, vegas.filter((i) => i.topic === t.id).length]));
  const tabs = [
    { id: "all", label: "All", emoji: "" },
    ...[...TOPICS, LOCAL_FALLBACK].filter((t) => counts[t.id]),
    ...(world.length ? [NATIONAL] : []),
  ];

  const okSources = [...new Set(news.status.filter((s) => s.ok).map((s) => s.name))];
  const updated = new Date(news.generatedAt).toLocaleString("en-US", {
    weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles", timeZoneName: "short",
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vegas News Brief</title>
<meta name="description" content="Las Vegas local news plus CNN and major national headlines, updated twice a day.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script>try{var t=localStorage.getItem('vnb-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<style>
:root{
  --bg:#f6f4ef;--surface:#ffffff;--surface-2:#efece4;--text:#1a1915;--muted:#625e55;--faint:#8c877c;
  --line:#e2ded3;--accent:#a8740a;--accent-ink:#ffffff;--accent-soft:#f5e9cc;--shadow:0 1px 2px rgba(0,0,0,.05),0 4px 14px rgba(0,0,0,.04);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#111110;--surface:#1b1b19;--surface-2:#252521;--text:#eeede8;--muted:#aaa69c;--faint:#7d7a72;
    --line:#2e2d29;--accent:#e2b54e;--accent-ink:#1a1405;--accent-soft:#2c2614;--shadow:none;
  }
}
:root[data-theme="dark"]{
  --bg:#111110;--surface:#1b1b19;--surface-2:#252521;--text:#eeede8;--muted:#aaa69c;--faint:#7d7a72;
  --line:#2e2d29;--accent:#e2b54e;--accent-ink:#1a1405;--accent-soft:#2c2614;--shadow:none;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scroll-padding-top:120px}
body{background:var(--bg);color:var(--text);font:17px/1.55 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:1180px;margin:0 auto;padding:0 16px}
.serif{font-family:'Source Serif 4',Georgia,serif}

/* Masthead */
.masthead{padding:28px 0 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.brand{font:700 clamp(30px,5vw,44px)/1 'Source Serif 4',Georgia,serif;letter-spacing:-.5px}
.brand span{color:var(--accent)}
.dateline{color:var(--muted);font-size:14px;margin-top:8px}
.dateline b{color:var(--text);font-weight:600}
.icon-btn{background:var(--surface);border:1px solid var(--line);color:var(--text);border-radius:999px;height:38px;padding:0 14px;font:500 14px Inter,sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.icon-btn:hover{border-color:var(--accent)}

/* Sticky tools: search + topic tabs */
.tools{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.tools .wrap{display:flex;flex-direction:column;gap:10px;padding-top:10px;padding-bottom:10px}
.search{position:relative}
.search input{width:100%;height:44px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--text);font:16px Inter,sans-serif;padding:0 14px 0 40px;outline:none}
.search input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.search svg{position:absolute;left:13px;top:13px;color:var(--faint)}
.tabs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px}
.tabs::-webkit-scrollbar{display:none}
.tab{flex:none;border:1px solid var(--line);background:var(--surface);color:var(--muted);border-radius:999px;padding:7px 14px;font:500 14px Inter,sans-serif;cursor:pointer;white-space:nowrap}
.tab:hover{color:var(--text);border-color:var(--faint)}
.tab[aria-pressed="true"]{background:var(--text);color:var(--bg);border-color:var(--text)}
.tab .n{opacity:.6;margin-left:4px;font-size:12px}

/* Brief */
.brief{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:22px 24px;margin:22px 0 8px;box-shadow:var(--shadow)}
.brief summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brief summary::-webkit-details-marker{display:none}
.brief summary h2{font:700 22px/1.2 'Source Serif 4',Georgia,serif}
.brief summary .hint{font-size:13px;color:var(--faint)}
.brief[open] summary .hint::after{content:"Hide"}
.brief:not([open]) summary .hint::after{content:"Show"}
.brief-cols{display:grid;grid-template-columns:3fr 2fr;gap:8px 32px;margin-top:14px}
.brief h3{font:600 13px/1 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin:4px 0 6px}
.brief ul{list-style:none}
.brief li{position:relative;padding:7px 0 7px 18px;border-top:1px solid var(--line);font-size:16px}
.brief li:first-child{border-top:0}
.brief li::before{content:"";position:absolute;left:2px;top:16px;width:6px;height:6px;border-radius:50%;background:var(--accent)}

/* Sections */
section{padding:30px 0 6px}
.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;border-bottom:2px solid var(--text);padding-bottom:8px;margin-bottom:16px}
.section-head h2{font:700 24px/1.2 'Source Serif 4',Georgia,serif}
.section-head span{font-size:13px;color:var(--faint)}

/* Cards */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:18px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;box-shadow:var(--shadow);transition:transform .15s,border-color .15s}
.card:hover{border-color:var(--faint);transform:translateY(-2px)}
.thumb{display:block;aspect-ratio:16/9;background:var(--surface-2);overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.card-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:6px}
.card h3{font:700 19px/1.3 'Source Serif 4',Georgia,serif}
.card h3 a:hover{text-decoration:underline;text-decoration-color:var(--accent);text-underline-offset:3px}
.card p{font-size:15px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card.no-img{border-top:3px solid var(--accent)}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:13px;color:var(--faint)}
.outlet{font-weight:600;color:var(--accent)}
.also{background:var(--surface-2);border-radius:999px;padding:1px 8px;font-size:12px;color:var(--muted)}
.chip-sm{font-weight:600;color:var(--text)}
time.new{color:#c2410c;font-weight:600}
:root[data-theme="dark"] time.new{color:#fb923c}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) time.new{color:#fb923c}}

/* Top stories: one big lead + smaller cards */
.top{display:grid;grid-template-columns:1.6fr 1fr;gap:18px}
.card-lead h3{font-size:clamp(24px,3vw,32px);line-height:1.15}
.card-lead p{-webkit-line-clamp:4;font-size:16px}
.top .side-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.card-small .thumb{aspect-ratio:16/10}
.card-small h3{font-size:17px}

/* Nation & World headline list */
.rows{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:0 32px}
.row{padding:12px 0;border-bottom:1px solid var(--line)}
.row > a{font:600 17px/1.35 'Source Serif 4',Georgia,serif;display:block;margin-bottom:4px}
.row > a:hover{text-decoration:underline;text-decoration-color:var(--accent);text-underline-offset:3px}

/* When a topic or search is active, top stories join the plain card grid */
.filtered #top .section-head{display:none}
.filtered .top{grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}
.filtered .side-grid{display:contents}
.filtered .card-lead h3{font-size:19px}
.filtered .card-lead p{-webkit-line-clamp:3;font-size:15px}
.brief .teaser{display:none;font-size:14px;color:var(--muted);margin-top:4px}
.brief:not([open]) .teaser{display:block}
@media (min-width:861px){.tabs{flex-wrap:wrap;overflow:visible}}
.empty{display:none;text-align:center;color:var(--muted);padding:60px 0}
.hidden{display:none !important}
footer{color:var(--faint);font-size:13px;padding:40px 0 60px;border-top:1px solid var(--line);margin-top:40px}
.to-top{position:fixed;right:16px;bottom:16px;z-index:30;opacity:0;pointer-events:none;transition:opacity .2s}
.to-top.show{opacity:1;pointer-events:auto}

@media (max-width:860px){
  .top{grid-template-columns:1fr}
  .brief-cols{grid-template-columns:1fr}
  .rows{grid-template-columns:1fr}
}
/* Phones: cards become compact rows (text left, photo right) for fast scanning */
@media (max-width:600px){
  body{font-size:16px}
  .grid,.top .side-grid{grid-template-columns:1fr;gap:0}
  .grid .card,.top .side-grid .card{flex-direction:row-reverse;border:0;border-bottom:1px solid var(--line);border-radius:0;box-shadow:none;background:transparent;transform:none}
  .grid .card.no-img,.top .side-grid .card.no-img{border-top:0}
  .grid .thumb,.top .side-grid .thumb{flex:0 0 96px;width:96px;height:72px;aspect-ratio:auto;border-radius:10px;margin:14px 0 14px 12px}
  .grid .card-body,.top .side-grid .card-body{padding:12px 0}
  .grid .card h3,.top .side-grid .card h3{font-size:17px}
  .grid .card p{display:none}
  .brief{padding:18px}
  .masthead{padding:20px 0 12px}
  #theme span{display:none}
  #theme{padding:0 11px}
  .section-head h2{font-size:21px}
}
</style>
</head>
<body>
<header class="wrap masthead">
  <div>
    <div class="brand">Vegas<span>.</span>Brief</div>
    <div class="dateline"><b>${esc(dateLabel)}</b> · Updated ${esc(updated)} · ${okSources.length} sources</div>
  </div>
  <button class="icon-btn" id="theme" type="button" aria-label="Switch light or dark mode"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg><span>Theme</span></button>
</header>

<div class="tools">
  <div class="wrap">
    <label class="search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="Search stories, places, outlets…" aria-label="Search stories" autocomplete="off">
    </label>
    <nav class="tabs" aria-label="Topics">
      ${tabs.map((t, i) => `<button class="tab" type="button" data-tab="${t.id}" aria-pressed="${i === 0}">${t.emoji ? `${t.emoji} ` : ""}${esc(t.label)}${t.id !== "all" ? `<span class="n">${t.id === NATIONAL.id ? world.length : counts[t.id]}</span>` : ""}</button>`).join("")}
    </nav>
  </div>
</div>

<main class="wrap">
  ${brief ? `
  <details class="brief" id="brief" open>
    <summary><div><h2>Today's brief</h2><div class="teaser">The day's top stories in 30 seconds</div></div><span class="hint"></span></summary>
    ${briefToHtml(brief)}
  </details>` : ""}

  ${top.length ? `
  <section id="top" data-group="top">
    <header class="section-head"><h2>Top stories</h2><span>Most covered in Las Vegas right now</span></header>
    <div class="top">
      ${card(top[0], { size: "lead", showTopic: true })}
      <div class="side-grid">${top.slice(1).map((i) => card(i, { size: "small", showTopic: true })).join("")}</div>
    </div>
  </section>` : ""}

  ${groups.map((g) => `
  <section id="${g.id}" data-group="${g.id}">
    <header class="section-head"><h2>${g.emoji} ${esc(g.label)}</h2><span>${g.items.length} ${g.items.length === 1 ? "story" : "stories"}</span></header>
    <div class="grid">${g.items.map((i) => card(i)).join("")}</div>
  </section>`).join("")}

  ${world.length ? `
  <section id="national" data-group="national">
    <header class="section-head"><h2>${NATIONAL.emoji} ${NATIONAL.label}</h2><span>CNN, AP, NPR, NBC, ABC, CBS, NYT, BBC</span></header>
    <ul class="rows">${world.map(headlineRow).join("")}</ul>
  </section>` : ""}

  <p class="empty" id="empty">No stories match your search.</p>

  <footer>
    Headlines and links belong to their publishers. Updated at 6 AM and 5 PM.<br>
    Sources this run: ${esc(okSources.join(", ") || "none")}.
  </footer>
</main>

<button class="icon-btn to-top" id="toTop" type="button" aria-label="Back to top">↑ Top</button>

<script>
(function(){
  var now = Date.now();
  document.querySelectorAll('time[datetime]').forEach(function(t){
    var mins = Math.round((now - new Date(t.getAttribute('datetime')).getTime()) / 60000);
    if (isNaN(mins) || mins < 0) return;
    if (mins < 60) { t.textContent = mins + 'm ago'; t.classList.add('new'); }
    else if (mins < 1440) { t.textContent = Math.round(mins / 60) + 'h ago'; if (mins < 120) t.classList.add('new'); }
  });

  // On phones the brief starts collapsed so stories are visible right away.
  if (matchMedia('(max-width:600px)').matches && document.getElementById('brief')) document.getElementById('brief').removeAttribute('open');

  var tab = 'all', q = '';
  var tabs = document.querySelectorAll('.tab');
  var sections = document.querySelectorAll('section[data-group]');
  var brief = document.getElementById('brief');
  var empty = document.getElementById('empty');

  function apply(){
    var any = false;
    sections.forEach(function(sec){
      var visible = 0;
      sec.querySelectorAll('[data-topic]').forEach(function(el){
        var okTab = tab === 'all' || el.dataset.topic === tab;
        var okQ = !q || el.dataset.search.indexOf(q) !== -1;
        var show = okTab && okQ;
        el.classList.toggle('hidden', !show);
        if (show) visible++;
      });
      sec.classList.toggle('hidden', visible === 0);
      if (visible) any = true;
    });
    if (brief) brief.classList.toggle('hidden', tab !== 'all' || !!q);
    document.querySelector('main').classList.toggle('filtered', tab !== 'all' || !!q);
    empty.style.display = any ? 'none' : 'block';
  }

  tabs.forEach(function(b){
    b.addEventListener('click', function(){
      tab = b.dataset.tab;
      tabs.forEach(function(x){ x.setAttribute('aria-pressed', x === b); });
      apply();
      window.scrollTo({ top: document.querySelector('.tools').offsetTop, behavior: 'smooth' });
    });
  });
  document.getElementById('q').addEventListener('input', function(e){ q = e.target.value.trim().toLowerCase(); apply(); });

  document.getElementById('theme').addEventListener('click', function(){
    var root = document.documentElement;
    var dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('vnb-theme', root.dataset.theme); } catch (e) {}
  });

  var toTop = document.getElementById('toTop');
  addEventListener('scroll', function(){ toTop.classList.toggle('show', scrollY > 900); }, { passive: true });
  toTop.addEventListener('click', function(){ scrollTo({ top: 0, behavior: 'smooth' }); });
})();
</script>
</body>
</html>
`;
}
