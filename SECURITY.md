# Security policy

## Reporting a vulnerability

If you discover a security issue in Hearthly, please report it privately.

**Do not** open a public GitHub issue for security problems.

Email: security@hearthly.invalid (replace with real address before going to
production).

We aim to acknowledge reports within **2 business days** and to provide a
fix or mitigation plan within **30 days** for high-severity issues.

## Scope

In scope:

- The mobile / citizen / agent / admin SPA at `/public/`
- The CMCC operator console SPA at `/cmcc-website/public/`
- The serverless API endpoints under `/api/` and `/cmcc-website/api/`
- The MQTT broker (`server/`) when self-hosted

Out of scope:

- Vulnerabilities in upstream dependencies (please report those upstream
  first; we will accept advisories for context).
- Issues in third-party services we integrate with (Supabase, Vercel,
  OpenAI, OpenStreetMap, CARTO).
- Mock / demo data — none of it is real and none of it is sensitive.

## What we'd like in a report

- A clear description of the issue and impact
- Steps to reproduce, ideally with a minimal proof of concept
- Affected version / commit hash
- Your name and contact for credit (optional)

## Safe harbour

Good-faith security research conducted in accordance with this policy will
not result in legal action from us. Please do not:

- Access data belonging to real users (the production deployment is a
  demo with synthetic data only — but please don't try to break that
  assumption deliberately)
- Run sustained denial-of-service against our hosts
- Phish, social-engineer, or otherwise target our team

## Production hardening checklist

Before any non-demo deployment, the following must be true. Track in
`docs/IP-SAFETY.md`.

- [ ] All `OPENAI_API_KEY`, `SUPABASE_*`, and `JWT_SECRET` values rotated
      out of any committed history and stored in a secret manager.
- [x] CMCC OTP-bypass shortcut (`123456`) gated behind `isDemoMode()`.
      The bypass is **automatically disabled** the moment a real SMS
      provider env var is set (`MSG91_API_KEY`, `TWILIO_AUTH_TOKEN`,
      or `GUPSHUP_API_KEY`). Production deploys can also disable it
      explicitly with `DEMO_MODE=0`. Demo deploys keep working with no
      env var set. Implemented in `cmcc-website/api/_lib.js · isDemoMode()`.
- [x] Rate limiting added to all public-write endpoints
      (`/api/auth/otp/{request,verify}`, `/api/grievances/submit`,
      `/api/photo-verify`, `/api/whatsapp/inbound`). In-memory v1 —
      good enough to deter casual abuse, imperfect on serverless. v2
      should swap for **Upstash Redis** or **Vercel KV** for shared
      counters across function instances.
- [ ] Real SMS provider wired (MSG91 / Twilio / Gupshup) and
      `DEMO_MODE=0` set in Vercel env.
- [ ] HMAC verify on Meta WhatsApp `X-Hub-Signature-256` header before
      the `/api/whatsapp/inbound` URL is published into Meta's webhook
      console.
- [ ] DPDP Act 2023 data-flow review complete — see
      `docs/DPDP-COMPLIANCE.md`.
- [ ] CARTO basemap licence acquired or basemap swapped to a licensed
      / self-hosted alternative.
- [ ] Threat model reviewed for all `/api/*` endpoints (input
      validation, SSRF, auth bypass, IDOR — rate limiting now done).
