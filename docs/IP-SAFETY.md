# IP safety — production readiness

Living checklist of intellectual-property risks identified in the Hearthly
codebase, the action taken, and what's left before any non-demo deployment.

Last reviewed: 2026-04-29.

## ✅ Fixed

| Risk | Action |
|---|---|
| Citizen portal claimed "© Government of Telangana" in footer | Replaced with "© Hearthly · Independent prototype · Demonstration only, not an official government service" |
| Citizen portal gov-bar carried "🇮🇳 भारत सरकार · Government of Telangana" | Replaced with "DEMO · Independent prototype · Not affiliated with any government body · Synthetic data · Live preview" |
| Citizen header subtitle claimed "Mee-Seva enabled · Aadhaar / DigiLocker login" — implies live integration | Replaced with "DEMO · designed for Mee-Seva / Aadhaar / DigiLocker integration" |
| CMCC Settings → Integrations table claimed live "connected" / "synced 14m ago" / "UIDAI-licensed" status for ~20 govt + commercial integrations | Every badge re-labelled "mock" or "design"; section gets a clear demo-mode notice header |
| Municipal dashboard "Auto-reported to portals" table claimed live SBM / AMRUT / Smart Cities sync | Section re-labelled "design-ready · demo" with explanatory notice; every badge is now "mock" |
| Legacy CMCC Settings → Integrations claimed live "Razorpay (UPI) connected · webhooks armed" + similar | All badges relabelled "mock"; demo-notice header added |
| Leaflet maps suppressed OSM attribution (`attributionControl: false`) — violates ODbL | Re-enabled `attributionControl: true` + explicit `attribution` string on all four tile layers |
| No top-level LICENSE | Apache-2.0 added (chosen for explicit patent grant — friendlier to gov procurement) |
| No NOTICE file | Added with full descriptive-use disclaimer for every brand / programme name referenced |
| No third-party licence inventory | `THIRD_PARTY_LICENSES.md` added |
| No security disclosure path | `SECURITY.md` added |
| No privacy notice template | `docs/PRIVACY.md` added |
| No DPDP-Act-2023 readiness doc | `docs/DPDP-COMPLIANCE.md` added |

## 🟡 Mitigated, but watch on prod-deploy

| Risk | Why it's still on the list | Action when going to prod |
|---|---|---|
| **CARTO basemap tiles** (`basemaps.cartocdn.com/dark_all/...`) — free for non-commercial, paid for commercial | Used in 3 maps (legacy CMCC, new dashboard, municipal dashboard) | Either acquire a CARTO licence, OR swap to a self-hosted OSM raster server / paid Mapbox / Stadia Maps. Pure OSM tiles (`tile.openstreetmap.org`) carry a strict no-heavy-traffic policy — also unsuitable for prod. |
| **Brand-name references in mock integration tables** (Mee-Seva, Aadhaar, MoHUA, etc.) | Each is now badged "mock" or "design-ready" with a clear demo-mode notice. This is descriptive / nominative fair use. | Before showing to any government audience, prepare a one-pager that clarifies "design-ready" means we have implemented the adapter contract on our side, not that any partner has agreed to integrate. |
| **OTP shortcut `123456`** present in `verify` flow for demo | Documented in `SECURITY.md` | Build-env gate: `if (process.env.NODE_ENV === 'production') reject the static code`. |
| **Hindi market positioning ("Hearthly · Real-Time Governance for Telangana")** | Telangana is a place name; positioning is a market statement, not a claim of affiliation. | OK to keep. If a logo or seal is added later, run a fresh IP audit. |
| **🇮🇳 flag emoji** on landing | Unicode character; descriptive. Not a state emblem. | OK. Indian *State Emblem* (Ashoka pillar / Sarnath lions) is protected — never embed it. |

## ⬜ Open before production launch

- [ ] Legal review of `LICENSE` choice (Apache-2.0 vs MIT) for the deploying entity
- [ ] Trademark search on "Hearthly" in the relevant classes (software / civic services) before mass-market launch
- [ ] Sign a CARTO commercial licence OR migrate to Mapbox / Stadia / self-hosted tiles
- [ ] Pen-test of `/api/*` endpoints
- [ ] DPDP DPO appointment + grievance officer designation
- [ ] CMCC console: gate the demo OTP shortcut behind `NODE_ENV !== 'production'`
- [ ] Add visible "DEMO MODE — synthetic data" pill to CMCC topbar (citizen portal already has it)
- [ ] Replace `security@hearthly.invalid` with a real address
- [ ] Generate full transitive licence tree via `license-checker --production` and commit `licenses.json`

## How to re-audit

```sh
# Government-affiliation claims
grep -rn "Government of\|भारत सरकार\|तेलंगाना सरकार\|Govt of\|© Government\|UIDAI-licensed\|connected\b" \
  --include="*.html" --include="*.js" --include="*.css" public/ cmcc-website/public/

# Map attribution
grep -rn "tileLayer\|attributionControl" --include="*.js" public/ cmcc-website/public/

# Hardcoded secrets
grep -rIn "sk-\|api[_-]key\|secret\|bearer\|password" --include="*.html" --include="*.js" public/ cmcc-website/public/
```

If any of those greps surface a result that looks like a live claim or a
real secret — it goes back into the "Open before production launch" section.
