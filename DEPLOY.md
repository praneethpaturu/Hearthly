# Vercel deployment guide

The repo is set up to deploy as **two Vercel Hobby projects from this one
GitHub repo**, sharing the source but with different "Root Directory"
settings:

| Project | Root Directory | What it serves |
|---------|---------------|----------------|
| `hearthly` (mobile) | `/` | Static `public/` — Resident / Agent / Admin SPAs. The mock backend in `api.js` runs in the browser, so no server is needed. |
| `hearthly-cmcc` (operator + citizen) | `cmcc-website` | Static `cmcc-website/public/` plus six Vercel serverless functions in `cmcc-website/api/` — operator OTP login, `/me`, heartbeat, network, audit, health. |

This is the most "holistic" deployment possible on the Vercel Hobby tier.
What's intentionally **not** deployed:

- The Aedes MQTT broker — Vercel functions can't bind a TCP port.
- The persistent Socket.IO server — Vercel functions are short-lived and
  stateless. The mobile SPA's in-browser `BroadcastChannel` event bus
  replaces Socket.IO for same-browser tab sync.
- Auto-bin pickup via MQTT — instead, click any bin in the admin UI to
  publish a fill level (the `api.js` mock invokes the same auto-create
  logic locally).

Heartbeat / network state is held **in-memory** inside the Vercel
function container. It survives between warm invocations but resets on
cold starts. No external DB needed.

## One-time setup on vercel.com

1. Go to <https://vercel.com/new> and import the GitHub repo
   `praneethpaturu/Hearthly`. Click **Import**.

2. **Project 1 — Mobile**:
   - Project Name: `hearthly` (or anything)
   - Framework Preset: `Other`
   - Root Directory: leave as `/`
   - Build Command: leave empty
   - Output Directory: `public`
   - Click **Deploy**.

3. **Project 2 — CMCC**: back at <https://vercel.com/new>, import the
   same repo again as a separate project.
   - Project Name: `hearthly-cmcc`
   - Framework Preset: `Other`
   - Root Directory: `cmcc-website`
   - Build Command: leave empty
   - Output Directory: `public`
   - Click **Deploy**.

After both deploys finish you'll have two URLs:
- `https://hearthly.vercel.app`
- `https://hearthly-cmcc.vercel.app`

(or whatever names Vercel assigned — they may be slightly different).

## Pointing the two projects at each other

The mobile app's "State Real-Time Governance Centre" tile and the admin
console's `CMCC ↗` button need to know the CMCC's URL. Resolution order
(see `public/index.html` and `public/admin.html`):

1. `?cmcc=<url>` query string on this visit
2. `localStorage['vl_cmcc_url']` (saved across sessions)
3. `window.HEARTHLY_CMCC_URL` injected via Vercel env var
4. Same-origin fallback `/cmcc/`
5. `http://localhost:4040` for local dev

The simplest is **option 3** — a build-time env var. In the **Mobile
project's** Vercel dashboard:

- Settings → Environment Variables
- Add `HEARTHLY_CMCC_URL` = `https://hearthly-cmcc.vercel.app` (your
  CMCC URL), exposed to all environments.
- For the variable to surface in client-side JS you also need a tiny
  injection, e.g. add a `public/_env.js` or set
  `window.HEARTHLY_CMCC_URL` from a `<script>` tag. The quickest path is
  to set it in the browser console once: `localStorage.setItem(
  'vl_cmcc_url', 'https://hearthly-cmcc.vercel.app')` and the choice
  persists.

The CMCC's "Per-community" button (which opens the mobile admin) does
the same lookup with `vl_mobile_url` / `HEARTHLY_MOBILE_URL` — set it
the same way in the **CMCC project**.

## Local dev

Nothing changes — `npm start` in the repo root runs the mobile Express
server (with MQTT) on `:3030`, and `npm start` inside `cmcc-website/`
runs the CMCC server on `:4040`. The browser-side URL resolver detects
`localhost` and uses the local servers automatically.

## Limits on Hobby tier

- 100 GB bandwidth / month — plenty for a demo.
- 100 GB-hours of function execution / month — well under the demo's
  needs (only the CMCC has functions).
- 10s function timeout — every endpoint here returns in milliseconds.
- No Vercel KV / Postgres are used, so the only state-loss vector is
  cold starts of the heartbeat / audit functions.

## Updating after deploy

`git push origin main` triggers a new build on both projects
automatically.
