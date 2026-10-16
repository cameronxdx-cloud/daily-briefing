# On-time scheduler (Cloudflare Worker)

GitHub's built-in scheduler is best-effort. The Daily Brief, scheduled for 6 AM, regularly ran between 10 AM and 2 PM. This Cloudflare Worker uses Cron Triggers, which fire on the minute, to start the workflows instead:

| Las Vegas time | Starts | Message arrives |
|---|---|---|
| 5:59 AM | Daily WhatsApp Briefing + Vegas News Brief | ~6:00 AM |
| 4:59 PM | Vegas News Brief | ~5:00 PM |

It follows daylight saving automatically. Cloudflare's free plan covers it.

## Setup (about 10 minutes)

### 1. Create a GitHub token that can only start workflows

1. Go to **github.com → your avatar → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Name:** `daily-briefing-scheduler`. **Expiration:** the longest allowed. Set a reminder to renew it.
3. **Repository access:** *Only select repositories* → `daily-briefing`.
4. **Permissions → Repository permissions → Actions:** **Read and write**. Leave everything else at *No access*.
5. Click **Generate token** and copy it. It starts with `github_pat_`.

### 2. Create the Worker

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Create Worker** (Start with Hello World).
2. Name it `daily-briefing-scheduler` and click **Deploy**.
3. Click **Edit code**, replace everything with the contents of [`worker.js`](worker.js), and click **Deploy**.

### 3. Add the token

In the Worker, go to **Settings → Variables and Secrets → Add**:
- **Type:** Secret
- **Name:** `GITHUB_TOKEN`
- **Value:** the token from step 1

Click **Deploy**.

### 4. Add the four cron triggers

In the Worker, go to **Settings → Trigger events → Add → Cron Triggers**. Add each of these. They're in UTC: each local time needs one entry for summer and one for winter, and the Worker ignores the one that doesn't apply that day.

```
59 12 * * *
59 13 * * *
59 23 * * *
59 0 * * *
```

### 5. Test it

- Open the Worker's URL (`https://daily-briefing-scheduler.<you>.workers.dev`). It should show the Las Vegas time and the schedule. Visiting the URL never sends anything.
- Next morning, check **Actions** in the repo. Both runs should start at 5:59 AM. In the Worker, **Logs** shows `Started daily-briefing.yml` and `Started vegas-news.yml`, or the GitHub error if the token is wrong or expired.

## Changing times

Edit `SCHEDULE` in `worker.js` and redeploy. If a new time has a different minute, also add matching UTC cron triggers. Each Las Vegas time needs two: UTC = local + 7 in summer and + 8 in winter.

## Deploying from the command line (optional)

`wrangler.toml` already lists the triggers:

```bash
cd scheduler
npx wrangler deploy
npx wrangler secret put GITHUB_TOKEN
```
