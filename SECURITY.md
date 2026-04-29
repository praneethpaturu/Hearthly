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
- [ ] CMCC OTP-bypass shortcut (`123456`) removed or gated by a build env.
- [ ] DPDP Act 2023 data-flow review complete — see `docs/DPDP-COMPLIANCE.md`.
- [ ] CARTO basemap licence acquired or basemap swapped to a licensed
      / self-hosted alternative.
- [ ] Threat model reviewed for all `/api/*` endpoints (rate limiting,
      input validation, SSRF, auth bypass).
