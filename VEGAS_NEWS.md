# Vegas News Brief

A local news app for Las Vegas. It pulls headlines from Las Vegas outlets, CNN and other major news sites, publishes them as an easy-to-read web page, and texts you a summary on WhatsApp through Twilio.

## What it does

1. **Fetches the news** (`src/vegas/feeds.js`) from the sources listed in `src/vegas/sources.js`:
   - **Local:** Las Vegas Review-Journal, Las Vegas Sun, 8 News Now (KLAS), FOX5 (KVVU), KTNV 13 Action News, News 3 (KSNV), Nevada Public Radio, The Nevada Independent, Nevada Current
   - **National:** CNN, Associated Press, NPR, NBC, ABC, CBS, Fox News, New York Times, BBC, plus a Google News search for "Las Vegas"

   It drops stories older than 36 hours, merges duplicates (the same story from several outlets), and pulls any national story that mentions Vegas into its own section.
2. **Summarizes** the headlines with Claude (`src/vegas/summarize.js`) into a short brief: 4–6 Las Vegas bullets and 3–4 national bullets. Without an `ANTHROPIC_API_KEY` it sends a plain headline list instead.
3. **Builds the page** (`src/vegas/render.js`) at `site/vegas/index.html`: the brief at the top, then *Las Vegas & Nevada*, *Vegas in the national news* and *Nation & World*. It works on phones and follows your light or dark mode.
4. **Sends the WhatsApp message** with Twilio, with a link to the full page. It then waits up to 60 seconds for WhatsApp to confirm delivery. If the message fails, the run turns red and the log shows Twilio's error code with a hint on how to fix it.

## Schedule

`.github/workflows/vegas-news.yml` runs at **7 AM and 5 PM Pacific**. You can also run it by hand: **Actions → Vegas News Brief → Run workflow**. Untick *send* to rebuild the page without texting.

## Setup

1. **Repository secrets** (Settings → Secrets and variables → Actions). These are the same ones the existing daily briefing uses:

   | Secret | Example |
   |---|---|
   | `TWILIO_ACCOUNT_SID` | `ACxxxxxxxx…` |
   | `TWILIO_AUTH_TOKEN` | from the Twilio console |
   | `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (Twilio sandbox, or your approved sender) |
   | `YOUR_WHATSAPP_NUMBER` | `whatsapp:+17025551234`; separate several numbers with commas |
   | `ANTHROPIC_API_KEY` | optional, needed for the AI summary |

2. **GitHub Pages** (optional, for the full-story page): Settings → Pages → Source: **GitHub Actions**. Each run publishes both pages together:
   - `https://<user>.github.io/<repo>/` → your existing Daily Brief page (`index.html`), unchanged
   - `https://<user>.github.io/<repo>/vegas/` → the Vegas news page

   If Pages is off, or still set to "Deploy from a branch", the workflow skips publishing and leaves a notice in the run log. The WhatsApp brief still sends and nothing on an existing site changes, but the link in the text won't open until Pages is switched over.

   After switching, edits to the Daily Brief `index.html` go live on the next Vegas run. To publish one right away, run the workflow by hand with *send* unticked.

3. **WhatsApp rules (Twilio):**
   - **Sandbox:** each recipient has to send `join <your-code>` to the sandbox number first, and send something again every 72 hours to stay joined.
   - **Production sender:** WhatsApp only allows free-form messages within 24 hours of the recipient's last message. For scheduled messages outside that window you need an approved Content Template. Send it with `contentSid` / `contentVariables` instead of `body`.

## Run locally

```bash
npm install
npm run vegas:preview     # builds site/vegas/index.html and prints the WhatsApp text, no send
npm run vegas             # builds and sends (needs the Twilio env vars)
```

Open `site/vegas/index.html` in a browser to see the page.

## Customizing

- **Add or remove outlets:** edit `SOURCES` in `src/vegas/sources.js`. Any RSS or Atom feed works. For a site without a feed, use `googleNews("site:example.com when:2d")`.
- **Change which national stories count as Vegas news:** edit `VEGAS_KEYWORDS`.
- **Change the tone or length of the summary:** edit `SYSTEM` in `src/vegas/summarize.js`. Twilio's WhatsApp limit is 1,600 characters. Longer briefs are cut off at the last bullet that fits.
- **Change the send times:** edit the `cron` lines in the workflow. They're in UTC.
