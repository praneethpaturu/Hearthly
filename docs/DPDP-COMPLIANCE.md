# DPDP Act 2023 — readiness checklist

This document tracks Hearthly's readiness against the **Digital Personal
Data Protection Act, 2023** (India). It is written for procurement, legal,
and ITE&C reviews.

Status legend: ✅ ready · 🟡 partial / design only · ⬜ not yet implemented.

## §4 — Notice and consent

| Requirement | Status | Where |
|---|---|---|
| Notice in plain English + the user's language | 🟡 EN / HI shipped; TE / UR planned | `public/api.js` i18n map |
| Itemised purposes (no bundled consent) | ⬜ | TODO before launch |
| "Withdraw consent" path equivalent to "give consent" | ⬜ | TODO — citizen-app settings |

## §6 — Lawful basis

| Basis | Use case | Status |
|---|---|---|
| Consent | citizen reports, AI features | 🟡 demo banner present, full UX TBD |
| Performance of contract | worker telemetry, payments | 🟡 |
| Legitimate use (gov function) | grievance routing, audit logs | 🟡 — requires explicit MoU before relying on this |
| Specific exemption | research / statistics | ⬜ N/A for now |

## §8 — Data fiduciary obligations

| Obligation | Status | Notes |
|---|---|---|
| Reasonable security safeguards | 🟡 | TLS 1.3 (Vercel default), HMAC-SHA256 session tokens, Supabase RLS. Pen-test pending. |
| Data accuracy | 🟡 | Citizens can correct grievance text up to 24h after submit (design only). |
| Erasure on purpose-fulfilment | ⬜ | Cron-driven retention sweep TODO. |
| Breach notification within 72h | ⬜ | Runbook TODO. |
| Grievance redressal mechanism | 🟡 | RTI workflow exists in CMCC mock; needs DPB-compliant DPO contact. |

## §9 — Children's data

We do not knowingly collect data from anyone under 18 in the demo. A
production deployment must add age-gating before any account creation and
must obtain verifiable parental consent before processing children's
data.

## §10 — Significant Data Fiduciary (SDF)

If ITE&C / Telangana designates Hearthly as a Significant Data Fiduciary
under §10, the following additional duties apply (none implemented yet):

- ⬜ Appoint a Data Protection Officer based in India
- ⬜ Appoint an independent data auditor
- ⬜ Periodic Data Protection Impact Assessments (DPIA)

## §16 — Cross-border transfer

| Destination | Data | Status |
|---|---|---|
| USA — `api.openai.com` | grievance text + photo (optional) for AI triage | 🟡 — must be opt-in with explicit notice; consider Bedrock (`ap-south-1`) for sovereign deployments |
| USA — `vercel.com` infra | all SPA + API traffic | 🟡 — switch to AWS `ap-south-1` for sovereign deployments (see `DEPLOY_AWS.md`) |
| Singapore — Supabase | citizen DB if not self-hosted | 🟡 — switch to Supabase EU/IN region or self-host on RDS |

## §17 — Exemptions (research / startup)

The startup-class exemption (§17(2)) is unlikely to apply long-term. We do
not rely on it.

## §27–28 — Penalties (max ₹250 Cr)

The application's risk surface is tracked in `IP-SAFETY.md`. The largest
class of risk identified pre-launch:

1. False / outdated consent record  → fix: every consent stored with hash + timestamp
2. Cross-border AI calls without notice → fix: explicit per-feature opt-in
3. Retained synthetic data labelled as real → fix: never go to prod with the demo seed

## Appendix — DPB rule references

This file should be re-reviewed on each Data Protection Board (DPB) rule
notification. As of the last revision of this file, no DPB rules have
been notified that change the requirements above.
