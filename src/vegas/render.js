// Renders the news page as one self-contained static HTML file.

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const safeUrl = (u) => (/^https?:\/\//i.test(u ?? "") ? u : null);

const timeLabel = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })
    : "";

// WhatsApp-style *bold* / _italic_ / "• " bullets → HTML.
function briefToHtml(brief) {
  const inline = (s) => esc(s).replace(/\*([^*]+)\*/g, "<strong>$1</strong>").replace(/_([^_]+)_/g, "<em>$1</em>");
  const out = [];
  let list = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const raw of brief.split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^[•\-–]\s*/.test(line)) list.push(line.replace(/^[•\-–]\s*/, ""));
    else { flush(); out.push(`<h3>${inline(line.replace(/^\*(.*)\*$/, "$1"))}</h3>`); }
  }
  flush();
  return out.join("\n");
}

function storyCard(item, { lead = false } = {}) {
  const link = safeUrl(item.link) ?? "#";
  const img = safeUrl(item.image);
  return `
    <article class="story${lead ? " lead" : ""}${img ? " has-img" : ""}">
      ${img ? `<a class="thumb" href="${esc(link)}" target="_blank" rel="noopener" tabindex="-1"><img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.thumb').remove()"></a>` : ""}
      <div class="story-body">
        <div class="meta"><span class="outlet">${esc(item.outlet)}</span>${item.published ? ` · <time datetime="${esc(item.published)}">${esc(timeLabel(item.published))}</time>` : ""}</div>
        <h4><a href="${esc(link)}" target="_blank" rel="noopener">${esc(item.title)}</a></h4>
        ${item.summary ? `<p>${esc(item.summary)}</p>` : ""}
      </div>
    </article>`;
}

function section(id, title, subtitle, items) {
  if (!items.length) return "";
  return `
  <section id="${id}">
    <header class="section-head">
      <h2>${esc(title)}</h2>
      <p>${esc(subtitle)} · ${items.length} ${items.length === 1 ? "story" : "stories"}</p>
    </header>
    <div class="stories">
      ${items.map((it, i) => storyCard(it, { lead: i === 0 })).join("")}
    </div>
  </section>`;
}

export function renderPage({ news, brief, dateLabel }) {
  const { local, vegasNational, national } = news.sections;
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
<meta name="description" content="Las Vegas local news plus CNN and major national headlines, updated through the day.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#f7f5f0;--surface:#ffffff;--text:#1b1a17;--muted:#6b675e;--line:#e4e0d6;
  --accent:#b8860b;--accent-soft:#f6ecd2;--link:#1b1a17;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#121212;--surface:#1c1c1c;--text:#ecebe7;--muted:#a19d93;--line:#2c2b29;
    --accent:#e0b74a;--accent-soft:#2a2416;--link:#ecebe7;
  }
}
:root[data-theme="dark"]{
  --bg:#121212;--surface:#1c1c1c;--text:#ecebe7;--muted:#a19d93;--line:#2c2b29;
  --accent:#e0b74a;--accent-soft:#2a2416;--link:#ecebe7;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scroll-padding-top:64px}
body{background:var(--bg);color:var(--text);font:17px/1.6 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline;text-decoration-color:var(--accent);text-underline-offset:3px}
.wrap{max-width:860px;margin:0 auto;padding:0 16px}
.top{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.top .wrap{display:flex;align-items:center;gap:16px;height:56px;overflow-x:auto;white-space:nowrap}
.brand{font:700 20px/1 'Source Serif 4',Georgia,serif}
.brand span{color:var(--accent)}
.top nav{display:flex;gap:6px;margin-left:auto}
.top nav a{font-size:14px;font-weight:500;color:var(--muted);padding:6px 12px;border-radius:999px}
.top nav a:hover{background:var(--accent-soft);color:var(--text);text-decoration:none}
.hero{padding:36px 0 20px}
.hero .date{font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.hero h1{font:700 clamp(32px,6vw,48px)/1.1 'Source Serif 4',Georgia,serif;margin:8px 0}
.hero p{color:var(--muted);font-size:15px}
.brief{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:12px;padding:22px 24px;margin:12px 0 8px}
.brief h3{font:700 18px/1.3 'Source Serif 4',Georgia,serif;margin:14px 0 6px}
.brief h3:first-child{margin-top:0}
.brief ul{padding-left:20px}
.brief li{margin:6px 0}
.brief li::marker{color:var(--accent)}
section{padding:28px 0 8px}
.section-head{border-bottom:2px solid var(--text);padding-bottom:8px;margin-bottom:4px}
.section-head h2{font:700 26px/1.2 'Source Serif 4',Georgia,serif}
.section-head p{font-size:13px;color:var(--muted)}
.story{display:flex;gap:16px;padding:18px 0;border-bottom:1px solid var(--line)}
.story .thumb{flex:0 0 120px;order:2}
.story .thumb img{width:120px;height:84px;object-fit:cover;border-radius:8px;background:var(--line);display:block}
.story-body{flex:1;min-width:0}
.meta{font-size:13px;color:var(--muted);margin-bottom:4px}
.outlet{font-weight:600;color:var(--accent)}
.story h4{font:700 19px/1.3 'Source Serif 4',Georgia,serif}
.story p{font-size:15px;color:var(--muted);margin-top:6px}
.story.lead{flex-direction:column}
.story.lead .thumb{order:0;flex:none}
.story.lead .thumb img{width:100%;height:auto;aspect-ratio:16/9;border-radius:12px}
.story.lead h4{font-size:26px}
footer{color:var(--muted);font-size:13px;padding:32px 0 48px}
@media (max-width:560px){
  body{font-size:16px}
  .top nav a{padding:6px 8px}
  .story .thumb{flex-basis:88px}
  .story .thumb img{width:88px;height:66px}
  .story.lead h4{font-size:22px}
}
</style>
</head>
<body>
<div class="top"><div class="wrap">
  <a class="brand" href="#">Vegas<span>.</span>Brief</a>
  <nav>
    ${brief ? `<a href="#brief">Brief</a>` : ""}
    <a href="#local">Las Vegas</a>
    ${vegasNational.length ? `<a href="#vegas-national">Vegas in the news</a>` : ""}
    <a href="#national">Nation &amp; World</a>
  </nav>
</div></div>

<main class="wrap">
  <div class="hero">
    <div class="date">${esc(dateLabel)}</div>
    <h1>What's happening in Las Vegas today</h1>
    <p>Updated ${esc(updated)} · from ${okSources.length} local and national sources</p>
  </div>

  ${brief ? `<div class="brief" id="brief">${briefToHtml(brief)}</div>` : ""}

  ${section("local", "Las Vegas & Nevada", "Review-Journal, Las Vegas Sun, 8 News Now, FOX5, KTNV, News 3, Nevada Independent and more", local)}
  ${section("vegas-national", "Vegas in the national news", "Las Vegas stories from CNN and other major outlets", vegasNational)}
  ${section("national", "Nation & World", "Top stories from CNN, AP, NPR, NBC, ABC, CBS, NYT and BBC", national)}

  <footer>
    Headlines and links belong to their publishers. Sources reached this run: ${esc(okSources.join(", ") || "none")}.
  </footer>
</main>

<script>
// Swap clock times for "2h ago" so the page reads naturally.
(function(){
  var now = Date.now();
  document.querySelectorAll('time[datetime]').forEach(function(t){
    var mins = Math.round((now - new Date(t.getAttribute('datetime')).getTime()) / 60000);
    if (isNaN(mins) || mins < 0) return;
    t.textContent = mins < 60 ? mins + 'm ago' : mins < 1440 ? Math.round(mins/60) + 'h ago' : t.textContent;
  });
})();
</script>
</body>
</html>
`;
}
