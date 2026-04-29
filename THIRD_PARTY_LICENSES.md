# Third-party licenses

This file enumerates the licences of third-party software, content, and
network services used by the Hearthly project. It is intended to satisfy
attribution obligations and to make procurement / legal review easier.

## Direct npm dependencies

### Root project (`/package.json`)

| Package | Version | License | URL |
|---|---|---|---|
| aedes | ^0.51.3 | MIT | https://github.com/moscajs/aedes |
| cors | ^2.8.5 | MIT | https://github.com/expressjs/cors |
| express | ^4.21.2 | MIT | https://expressjs.com/ |
| jsonwebtoken | ^9.0.2 | MIT | https://github.com/auth0/node-jsonwebtoken |
| mqtt | ^5.10.3 | MIT | https://github.com/mqttjs/MQTT.js |
| nanoid | ^5.0.9 | MIT | https://github.com/ai/nanoid |
| socket.io | ^4.8.1 | MIT | https://socket.io/ |

### CMCC console (`/cmcc-website/package.json`)

| Package | Version | License | URL |
|---|---|---|---|
| @supabase/supabase-js | ^2.45.0 | MIT | https://github.com/supabase/supabase-js |
| cors | ^2.8.5 | MIT | https://github.com/expressjs/cors |
| express | ^4.21.2 | MIT | https://expressjs.com/ |
| jsonwebtoken | ^9.0.2 | MIT | https://github.com/auth0/node-jsonwebtoken |

All transitive dependencies inherit MIT / BSD / ISC permissive licences. To
regenerate this list with an exhaustive transitive tree, run:

```sh
npx license-checker --production --json --excludePrivatePackages > licenses.json
npx license-checker --production --csv --excludePrivatePackages > licenses.csv
```

(There is no GPL/AGPL/copyleft dependency in the production tree at the
time of writing.)

## Browser-loaded assets

| Asset | License | Notes |
|---|---|---|
| Inter font (Google Fonts CDN) | SIL OFL 1.1 | Free for any use. |
| Material Symbols Outlined (Google Fonts CDN) | Apache 2.0 | Free for any use. |
| Leaflet 1.9.x (CDN) | BSD-2-Clause | Free for any use. |
| Socket.IO client (bundled by server) | MIT | — |
| OpenStreetMap raster tiles | ODbL 1.0 | Attribution required: "© OpenStreetMap contributors". Heavy / commercial usage MUST switch to a self-hosted or paid tile provider. |
| CARTO basemaps (basemaps.cartocdn.com) | CARTO ToS | Free for non-commercial use only. **Commercial production deployments require a paid CARTO plan.** Track in `docs/IP-SAFETY.md`. |

## Network services (operational dependencies)

| Service | License / Terms | Production note |
|---|---|---|
| OpenAI API | OpenAI Business Terms | API outputs owned by you. By default OpenAI does not train on API traffic. |
| Supabase (hosted) | Commercial — per Supabase ToS | Self-hostable under PostgreSQL / Apache-2.0 if needed. |
| Vercel hosting | Commercial — per Vercel ToS | Project portable to AWS / on-prem; see `docs/DEPLOY_AWS.md`. |

## Brand / programme name references

The application references third-party brand names and government programme
names for **descriptive purposes only** (e.g. "designed to integrate with
Mee-Seva once approved"). No endorsement, certification, or live partnership
is implied by these references. Each reference is labelled in the UI as
"mock" or "design-ready". See `NOTICE` for the full list.

## Original content

The Hearthly icon (`icon.svg`), the per-surface design tokens, all
component CSS, and all application code authored by the Hearthly
contributors are licensed under the Apache License 2.0. See `LICENSE`.

All sample personas, addresses, and phone numbers are synthetic and do not
correspond to any real individual.
