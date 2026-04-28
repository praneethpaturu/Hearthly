# Hearthly — runnable demo

A working slice of the Hearthly IoT platform: REST + WebSocket backend, in-process MQTT broker, and three role-based web UIs (Resident / Agent / Admin) — all in one `npm start`.

## Run

Requires Node 18+.

```bash
cd hearthly-demo
npm install
npm start
```

Open <http://localhost:3030>.

(Override with `PORT=4000 MQTT_PORT=1884 npm start`.)

## Demo accounts

Single fixed OTP for all accounts: **`123456`** (also auto-filled on each login screen).

| Role     | Phone           |
|----------|-----------------|
| Resident | `+919999900001` |
| Agent    | `+919999900002` |
| Admin    | `+919999900003` |

Any other `+91XXXXXXXXXX` number auto-creates a fresh resident account.

## Suggested demo flow (3 browser windows side-by-side)

1. **Resident** — log in, book a *Laundry Pickup*. Mock UPI sheet appears for paid services.
2. **Agent** — the new task appears instantly. Tap **Start** → **Mark arrived** → **Scan RFID** → **Complete**. Status badges flip live in all three windows.
3. **Admin** — KPIs, smart-bin meters, and order log all update in real time. Click any bin and set its level to **85**: a `FULL` MQTT event auto-creates a garbage pickup, which pops up immediately in the Agent window.
4. **IoT background loop** — every 8s the bins drift up 0–3%. Eventually one crosses the 80% threshold on its own and the system self-dispatches a pickup.
5. **Language** — top-right selector switches the UI between EN / हिन्दी / తెలుగు.

## What's in the box

```
hearthly-demo/
├── src/
│   ├── server.js          REST + Socket.IO + IoT consumer
│   ├── mqtt.js            aedes broker + mqtt client helpers
│   └── db.js              in-memory store + seed
└── public/
    ├── index.html         role picker
    ├── resident.html      OTP login → booking → live tracking
    ├── agent.html         tasks → state machine → mock GPS stream
    ├── admin.html         KPIs, IoT controls, live order log
    ├── api.js             shared REST/Socket.IO/i18n helpers
    └── app.css
```

State is in-memory and resets on restart — that's intentional for a demo.

## What you can show

- **OTP-based auth**, JWT issued, stored in localStorage.
- **REST API** — `/api/orders`, `/api/agent/tasks/:id/{start,arrive,scan,complete}`, etc.
- **WebSocket events** — `order:new`, `order:status`, `agent:location`, `device:update` propagate to every relevant role in real time.
- **MQTT topics** — `valet/{community}/{device}/{telemetry|event|scan|cmd}`. Both the admin UI and the background simulator publish to the same broker; a single consumer in the backend translates events into business actions.
- **Auto-pickup logic** — bin ≥ 80% → MQTT `FULL` event → idempotent order creation → push to assigned agent.
- **RFID verification** — agent scan must match the flat's tag; otherwise the state transition is rejected.
- **QR fallback** — alternative scan path for the same transition.
- **Multi-language** — EN / HI / TE in the visible UI strings.
- **Mock UPI** — payment sheet shown for paid services with a `upi://pay?...` intent.

## Endpoints quick-reference

```
POST /api/auth/otp/request          {phone}                   -> {demoOtp}
POST /api/auth/otp/verify           {phone, otp}              -> {token, user}
GET  /api/me                        (auth)
PATCH /api/me                       {flatId, name, language}

GET  /api/services
GET  /api/flats

POST /api/orders                    {serviceId, scheduledAt?, notes?}
GET  /api/orders                    (filtered by role)
POST /api/orders/:id/cancel
POST /api/orders/:id/rate           {stars, comment}

POST /api/agent/tasks/:id/start
POST /api/agent/tasks/:id/arrive
POST /api/agent/tasks/:id/scan      {type: "RFID"|"QR", code}
POST /api/agent/tasks/:id/complete

GET  /api/admin/stats
GET  /api/admin/devices
GET  /api/admin/orders
GET  /api/admin/communities
POST /api/admin/iot/bin/:id/level   {level}     # publishes MQTT
POST /api/admin/iot/scan            {tag, orderId}
```

WebSocket (Socket.IO, `auth: { token }`):

```
emit  agent:location  {orderId, lat, lng, etaMin}
on    order:new       (enriched order)
on    order:status    (enriched order)
on    agent:location  {orderId, lat, lng, etaMin, agentId}
on    device:update   (device)
```

## How this maps to the production blueprint

| Demo                         | Production swap-in                                      |
|------------------------------|---------------------------------------------------------|
| In-memory `Map` store        | PostgreSQL + Prisma (schema in the design doc)          |
| `aedes` broker (in-process)  | AWS IoT Core / EMQX cluster, mTLS                       |
| Single Express process       | NestJS microservices over NATS JetStream                |
| Browser UI                   | Kotlin + Jetpack Compose Android app (MVVM)             |
| Mock UPI sheet               | Razorpay UPI Intent + signed webhooks                   |
| `console.log` OTP            | MSG91 DLT-approved SMS templates                        |
| Random-walk bin levels       | Real ESP32 firmware over MQTT/TLS                       |

The HTTP/WebSocket/MQTT contracts are shaped exactly the same as production, so the swap is mechanical.
