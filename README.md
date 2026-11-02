# SAFEPATH — Women Safe Route Navigator

**Your Safety. Your Journey. Your Confidence.**

SAFEPATH is a full-stack women's safety platform: plan walking journeys with transparent route
confidence estimates, find real nearby police stations and hospitals, share your live location with a
private expiring link, raise an SOS that reaches your trusted contacts, and report unsafe places that
moderators verify before publishing.

Built as a Community Service Project with **React + Tailwind CSS**, a **Node.js/Express REST API**,
**MySQL**, and **Leaflet + OpenStreetMap** maps.

---

## 1. What is actually implemented

| Area | Status | Notes |
|---|---|---|
| Landing page (hero, features, why, helplines, about, contact, footer) | ✅ | Live platform counts and official helplines from the API |
| Registration / login / logout | ✅ | bcrypt hashes, JWT in an httpOnly cookie |
| Forgot / reset password | ✅ | 30-minute single-use tokens; emailed when SMTP is configured |
| Profile management + password change | ✅ | Validation and error messages on every field |
| Dashboard | ✅ | Real counts, GPS card, nearby services, verified alerts, notifications |
| Safe route navigation + route comparison | ✅ | Real pedestrian routes (Valhalla → OSRM → labelled estimate) |
| Route safety scoring | ✅ | Verified reports + OSM lighting + activity, with per-factor explanations |
| Live location sharing | ✅ | Unguessable token, auto-expiring, revocable, 20-second updates |
| SOS emergency alert | ✅ | 5-second cancellable countdown, GPS capture, honest delivery report |
| Emergency contact management | ✅ | CRUD, primary contact, quick call |
| Nearby police / hospitals / ambulance | ✅ | Live OpenStreetMap (Overpass → Photon), local directory fallback |
| Safety reporting + image upload | ✅ | Pending → verified/rejected by an admin; anonymous on the public map |
| Notifications (in-app + browser) | ✅ | Mark read, mark all, nearby verified alerts, announcements |
| Women's safety awareness | ✅ | 8 seeded guides with sources + official links |
| Admin console | ✅ | Stats, moderation, users, service directory, awareness CMS, announcements, SOS log, audit |
| MySQL schema | ✅ | 15 tables with PK/FK constraints, indexes and enums |

Every button in the UI calls a real endpoint. Nothing is mocked, and no safety statistic is invented.

---

## 2. Requirements

- **Node.js 18+** (tested on Node 26)
- **MySQL 8.0+** (or MariaDB 10.6+)
- A modern browser with Geolocation support

No paid API keys are required. Maps, geocoding, routing and POI data come from public
OpenStreetMap-based services.

---

## 3. Quick start

```bash
# 1. Install backend dependencies
npm install

# 2. Install frontend dependencies
npm --prefix client install

# 3. Create your environment file
cp .env.example .env
#    then edit DB_HOST / DB_PORT / DB_USER / DB_PASSWORD as needed

# 4. Create the database and all tables
npm run db:setup

# 5. Seed the admin account, sample reports and safety guides
npm run db:seed

# 6. Run API (port 4000) + Vite dev server (port 3000)
npm run dev
```

Open **http://localhost:3000**.

### Seeded accounts

| Role | Email | Password |
|---|---|---|
| Demo user | `demo@safepath.app` | `Demo@12345` |
| Administrator | value of `ADMIN_EMAIL` (default `admin@safepath.app`) | value of `ADMIN_PASSWORD` (default `Admin@12345`) |

> Change `ADMIN_PASSWORD` in `.env` and re-run `npm run db:seed` before any real presentation.

The three seeded safety reports are **sample data**: their descriptions begin with `[SAMPLE DATA]`,
they carry `is_sample = 1` in the database, and the UI labels them as sample. No sample police
stations or hospitals are seeded — those come from live OpenStreetMap data.

---

## 4. Environment variables

Copy `.env.example` to `.env`. Nothing secret is committed.

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no (default 4000) | API port |
| `APP_URL` | yes | Public URL used in share links and reset links (`http://localhost:3000`) |
| `JWT_SECRET` | **yes** | Signs session cookies — use a long random string |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | yes | MySQL connection |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | yes | First administrator created by `npm run db:seed` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | no | Email delivery for SOS alerts and password resets |
| `SOS_WEBHOOK_URL` | no | Extra SOS channel (Slack / Discord / Telegram bridge) |
| `EXPOSE_RESET_TOKEN` | no (dev only) | Shows the password-reset link on screen when email is not configured |
| `OSRM_URL`, `VALHALLA_URL`, `OVERPASS_URL` | no | Override public routing / POI services |

### Important: what happens without SMTP

If `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are not set, SAFEPATH **does not pretend** an alert was sent.
The SOS dialog shows “Delivery status: not configured / failed”, lists exactly what happened per
contact, and puts your contacts' phone numbers and **112** in front of you so you can call directly.
Set SMTP credentials to enable real email delivery.

---

## 5. Project structure

```
safepath/
├── client/                    # React + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/        # Logo, MapView (Leaflet), AppLayout, SosProvider, ui
│   │   ├── context/           # Auth + toast providers
│   │   ├── hooks/             # useGeolocation
│   │   ├── lib/               # api client, formatting helpers
│   │   └── pages/             # 20 route-level screens
│   └── vite.config.js         # dev proxy → API, Tailwind plugin
├── server/                    # Express REST API
│   ├── db/                    # pool, schema.sql
│   ├── lib/                   # auth, http helpers, geo maths
│   ├── routes/                # auth, users, contacts, navigation, sharing, sos,
│   │                          # reports, notifications, services, awareness, public, admin
│   ├── services/              # routing, overpass, photon, safety scoring, notifications
│   ├── config.js
│   └── index.js
├── scripts/                   # dev runner, db-setup, seed
├── uploads/                   # report images (git-ignored, served at /uploads)
├── .env.example
└── README.md
```

---

## 6. Database

MySQL, 15 tables, created by [`server/db/schema.sql`](server/db/schema.sql):

| Table | Purpose |
|---|---|
`users` | registered women using the platform (bcrypt hashes, status) |
`emergency_contacts` | trusted contacts, one primary, optional email |
`safety_reports` | community reports with status, severity, image, sample flag |
`safe_routes` | routes a user saved (geometry + score snapshot) |
`police_stations`, `hospitals` | admin-managed fallback directory |
`location_history` | last 500 GPS fixes per user (private) |
`notifications` | per-user alerts and announcements |
`shared_locations` | live-share sessions with token, expiry, last position |
`admins` | separate administrator accounts (super_admin / moderator) |
`sos_alerts` | every SOS with delivery log (JSON) and contact count |
`awareness_content` | the women's safety guides (CMS-managed) |
`password_resets` | sha256-hashed reset tokens with expiry |
`admin_audit` | moderator action log |
`app_settings` | editable helpline numbers |

Primary/foreign keys are declared, deletions cascade from `users`, and geo columns are indexed.

---

## 7. API overview

All routes are under `/api`. Sessions use the `safepath_token` httpOnly cookie.

**Auth** `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` ·
`POST /auth/forgot-password` · `POST /auth/reset-password`

**Profile** `GET /users/me` · `PATCH /users/me` · `POST /users/me/password` ·
`GET /users/me/summary` · `POST /users/me/location`

**Contacts** `GET|POST /contacts` · `PATCH|DELETE /contacts/:id`

**Navigation** `GET /navigation/search` · `GET /navigation/reverse` · `POST /navigation/routes` ·
`GET /navigation/unsafe-points` · `GET|POST /navigation/saved` · `DELETE /navigation/saved/:id`

**Services** `GET /services/nearby` · `GET /services/helplines`

**Live sharing** `GET /sharing/active` · `POST /sharing/start` · `POST /sharing/location` ·
`POST /sharing/stop` · `GET /sharing/history` · public viewer `GET /public/share/:token`

**SOS** `GET /sos/status` · `POST /sos` · `POST /sos/:id/cancel` · `GET /sos/history`

**Reports** `POST /reports` (multipart) · `GET /reports/mine` · `GET /reports/nearby` ·
`DELETE /reports/:id`

**Notifications** `GET /notifications` · `POST /notifications/:id/read` ·
`POST /notifications/read-all` · `GET /notifications/nearby`

**Awareness** `GET /awareness` · `GET /awareness/:slug`

**Public** `GET /public/config` · `GET /public/stats` · `GET /public/share/:token`

**Admin** `POST /admin/login` · `GET /admin/me` · `POST /admin/logout` · `GET /admin/stats` ·
`GET /admin/users` · `PATCH /admin/users/:id` · `GET /admin/reports` · `PATCH /admin/reports/:id` ·
`GET|POST|PATCH|DELETE /admin/police` · `GET|POST|PATCH|DELETE /admin/hospitals` ·
`GET|POST|PATCH|DELETE /admin/awareness` · `POST /admin/announcements` · `GET /admin/sos` ·
`GET /admin/activity`

Validation errors return `422` with `{ error, details: [{ field, message }] }`; auth failures return
`401`/`403`; cross-origin writes are rejected by a same-origin guard.

---

## 8. How the route safety score works

`server/services/safety.js` implements **SAFEPATH Route Confidence v1**:

1. **Verified community reports** within 70 m of the route path — weighted by category
   (harassment 16 pts, unsafe route 11, poor lighting 10, suspicious activity 8, unsafe place 7),
   capped at −55.
2. **Street lighting** from OpenStreetMap street lamps sampled at 7 points along the route
   (0 lamps → −18, sparse → −10, moderate → −4).
3. **Public activity** from mapped shops, cafes, pharmacies, bus stops and police within 35 m of the
   samples (−12 to −6; small credit for late-opening businesses).
4. **Route shape** — a small penalty for very long detours.

If lighting/activity data could not be loaded, **the score is capped at 70** and labelled
“limited data”, so missing information never inflates confidence. The UI always shows the individual
factors, the impact of each, and this disclaimer:

> Route confidence is an estimate calculated from verified community reports, OpenStreetMap street
> lamp data and public-activity data. It is not a guarantee of safety. Always trust your instincts,
> travel with someone when you can, and contact 112 in an emergency.

---

## 9. External data sources and fallbacks

| Need | Primary | Fallback | If everything fails |
|---|---|---|---|
| Maps | OpenStreetMap tiles via Leaflet | — | Map area shows tiles error; lists still work |
| Pedestrian routes | Valhalla public router (`alternates=2`) | OSRM public router | Straight-line estimate, clearly labelled “Straight-line estimate” |
| Place search / reverse geocode | Nominatim | — | Manual latitude/longitude entry via map click |
| Police / hospitals / ambulance | Overpass API (mirror failover) | Photon (OSM POI search) | Admin-managed MySQL directory, with an on-screen explanation |
| Street lighting / activity | Overpass API | — | Score capped at 70, factors marked “data unavailable” |
| SOS / reset email | SMTP (nodemailer) | `SOS_WEBHOOK_URL` | Reported honestly as not configured / failed |

Public Overpass instances are frequently at capacity. SAFEPATH tries multiple mirrors and then falls
back to Photon, so nearby services are still real OpenStreetMap data. The response includes a
`source` field and a human-readable note that the UI displays.

---

## 10. Privacy and security

- Passwords: bcrypt (cost 12). No plaintext anywhere.
- Sessions: JWTs in `httpOnly`, `SameSite=Lax` cookies; `Secure` in production.
- Authorisation: every user endpoint filters by `req.user.id`; admin routes require an admin token.
- Same-origin guard rejects state-changing requests from foreign origins.
- Rate limits on auth, SOS-adjacent routes and the public share viewer.
- Public reports expose the incident only — never the reporter's name or email.
- Live-share pages expose a first name, city and coordinates only, behind an unguessable token that
  expires and can be revoked instantly.
- Uploaded images are validated by MIME type and size (5 MB), stored outside the web root and served
  read-only from `/uploads`.
- Location history is private, capped at 500 fixes per user.

---

## 11. Limitations (please read before presenting)

1. **Safety scores are estimates, not guarantees.** The UI says this on every screen that shows a
   score.
2. **SOS does not dispatch police or an ambulance.** It records the alert and (when configured)
   delivers it to your contacts. Calling 112 is always the real emergency action.
3. **Email requires SMTP configuration.** Without it, SOS delivery is reported as failed — by design.
4. **Live sharing updates while the page is open** (20-second interval + geolocation watch). It is not
   a background push service, and closing the tab stops updates.
5. **Browser notifications require permission** and only appear while the app is open.
6. **Emergency service data is community-mapped** OpenStreetMap data; phone numbers may be missing.
   Call 112 when in doubt.
7. **Route confidence uses OpenStreetMap lighting/activity data**, which is incomplete in many Indian
   cities. Missing data lowers (caps) the score rather than being ignored.
8. Sample reports (3) are demonstration data, explicitly labelled in the app and the database.

---

## 12. Production build

```bash
npm run build          # builds client/dist
NODE_ENV=production npm start   # Express serves the API + built SPA on PORT
```

Set `APP_URL` to the public origin, `COOKIE_SECURE=true` behind HTTPS, and provide real SMTP
credentials so SOS alerts leave the platform.

### Database maintenance

```bash
npm run db:setup   # applies schema.sql (idempotent)
npm run db:seed    # creates admin, sample reports, guides; safe to re-run
```

---

## 13. Verification performed

- `npm run db:setup` created 15 tables; `npm run db:seed` created the admin, demo user, 3 sample
  reports and 8 guides.
- Frontend production build (`npm run build`) compiles without errors.
- API flows exercised against MySQL: register/login/logout, profile update, contact CRUD,
  route comparison (Valhalla returning live pedestrian routes), nearby services (live Photon results,
  21 police + 30 hospitals within 3 km of MG Road), live sharing start/update/public view/stop,
  SOS with honest “not configured” delivery status, report submission, admin verification
  (which notified a nearby user), announcement broadcast, and the awareness feed.
- GPS, camera upload and browser notifications require a real browser session — they are handled with
  explicit permission-denied messages and could not be exercised headlessly here.

---

*SAFEPATH is a student Community Service Project. It complements — never replaces — the police and
emergency services. In an emergency, call **112**.*
