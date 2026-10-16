// Cloudflare Worker that starts the GitHub Actions workflows on time.
//
// GitHub's own `schedule:` trigger is best-effort and often runs hours late,
// so this Worker's Cron Triggers call GitHub's "run workflow" API instead.
//
// Cron Triggers are UTC-only. To follow Las Vegas time through daylight
// saving, the Worker fires at both possible UTC times and only acts when the
// local time in Las Vegas matches an entry in SCHEDULE.
//
// Runs start one minute early so the WhatsApp message lands right on the hour
// (a run takes ~30–60 seconds from start to send).
//
// Required secret:  GITHUB_TOKEN  (fine-grained token, this repo only,
//                                  "Actions: Read and write")

const OWNER = "cameronxdx-cloud";
const REPO = "daily-briefing";
const TIME_ZONE = "America/Los_Angeles";

// Local Las Vegas time (HH:MM, 24h) → workflow files to start.
const SCHEDULE = {
  "05:59": ["daily-briefing.yml", "vegas-news.yml"], // lands ~6:00 AM
  "16:59": ["vegas-news.yml"],                       // lands ~5:00 PM
};

function localTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
}

async function dispatch(workflow, token) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "daily-briefing-scheduler",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );
  if (res.status !== 204) {
    throw new Error(`${workflow}: GitHub returned ${res.status} ${await res.text()}`);
  }
  console.log(`Started ${workflow}`);
}

export default {
  async scheduled(event, env, ctx) {
    const now = localTime(new Date(event.scheduledTime));
    const workflows = SCHEDULE[now];
    if (!workflows) {
      console.log(`${now} Las Vegas time — nothing scheduled (other half of the DST pair).`);
      return;
    }
    const results = await Promise.allSettled(workflows.map((w) => dispatch(w, env.GITHUB_TOKEN)));
    const failed = results.filter((r) => r.status === "rejected");
    failed.forEach((r) => console.error(r.reason.message));
    if (failed.length) throw new Error(`${failed.length} workflow(s) failed to start`);
  },

  // Visiting the Worker's URL shows the schedule; it never starts anything.
  async fetch() {
    const lines = Object.entries(SCHEDULE).map(([t, w]) => `${t} → ${w.join(", ")}`);
    return new Response(
      `Daily briefing scheduler\nLas Vegas time now: ${localTime(new Date())}\n\n${lines.join("\n")}\n`,
      { headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  },
};
