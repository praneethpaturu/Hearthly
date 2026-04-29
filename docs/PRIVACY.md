# Privacy notice (demo)

> This is a **demonstration prototype**. No real personal data is collected
> by the deployed demo. All personas, addresses, and phone numbers shown
> are synthetic.

This document is the template that would govern a production deployment of
Hearthly. It is also written to be DPDP-Act-2023 ready (see
`DPDP-COMPLIANCE.md`).

## What we would collect (production)

| Category | Field | Lawful basis | Retention |
|---|---|---|---|
| Identifiers | mobile number, OTP-derived session token | consent / contract | session lifetime + 90 days audit |
| Civic reports | grievance text, photo, geolocation, ward | consent | until grievance closed + 7 years (gov record-keeping requirement) |
| Worker telemetry | RFID/QR scan, GPS trail during shift, photo proof | contract (employment) | shift + 180 days |
| Operator audit | who-did-what for every CMCC action | legal obligation | 7 years |
| AI conversation | prompts and responses sent to / received from OpenAI | consent | 0 days client-side; transient at OpenAI per their API ToS |
| Optional Aadhaar | last-4 only, with explicit consent flag | consent (DPDP) | until consent withdrawn |

## What we never collect

- Full Aadhaar number (only last-4 with explicit opt-in, in production).
- Biometrics.
- Bank account numbers (UPI handles only, processed by Razorpay if enabled).
- Health data unrelated to a civic complaint.

## Data flow

```
Citizen device  ─►  Vercel function (or AWS API Gateway / ECS)
                    │  POST /api/grievance
                    ▼
                  Supabase Postgres (or RDS) — ap-south-1
                    │  RLS: ward officers see only their ward
                    ▼
                  Optional: SBM portal / Mee-Seva (out-of-band, batch)
```

Cross-border transfer: **none**. Compute and storage stay in `ap-south-1`
(Mumbai). OpenAI calls go to `api.openai.com` (US) — this is a flagged
transfer in the DPDP audit and requires explicit consent on first use.

## Subject rights

In a production deployment we would honour, on a verified DPDP request:

- **Access** — full export within 30 days
- **Correction** — within 7 days
- **Erasure** — within 30 days, except records subject to legal retention
- **Withdraw consent** — immediate, with a documented impact

Demo deployments do not collect data subject to these rights.

## Contact

Privacy questions: `privacy@hearthly.invalid` (replace before production).
Grievance Officer (DPDP §13): _to be appointed before production launch._
