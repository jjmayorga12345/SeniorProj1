# Eventure — Production Deployment Audit & Plan

**Document:** Senior DevOps Engineer + Full Stack Architect audit  
**Date:** February 3, 2026  
**Status:** Audit complete — **NO CODE CHANGES MADE**. Awaiting your answers and confirmation before implementation.

---

# STEP 1 — PROJECT AUDIT

## Full Tech Stack

| Layer | Technology | Version / Notes |
|-------|------------|-----------------|
| **Frontend** | React | ^19.2.0 |
| | Vite | ^7.2.4 |
| | React Router | ^7.12.0 |
| | Tailwind CSS | ^3.4.17 |
| | Leaflet / React-Leaflet | ^1.9.4 / ^5.0.0 (maps) |
| **Backend** | Node.js | Not pinned in package.json |
| | Express | ^5.2.1 |
| **Database** | MySQL | 5.7+ compatible (utf8mb4) |
| | Sequelize (ORM) | ^6.37.7 |
| | mysql2 (raw pool) | ^3.16.1 |
| **Auth** | JWT (jsonwebtoken) | ^9.0.3 |
| | bcrypt | ^6.0.0 |
| | Cookie (httpOnly, sameSite: lax) | — |
| **File upload** | Multer | ^2.0.2 |
| **Email** | Nodemailer | ^7.0.12 (SMTP) |
| **Other** | dotenv, cors, cookie-parser | — |

## Folder Structure

```
SeniorProj1/
├── client/                    # Frontend (React + Vite)
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── api.js              # Central API client (fetch + VITE_API_URL)
│   │   ├── App.jsx, main.jsx
│   │   ├── components/         # AddressAutocomplete, EventMap, NavBar, ProtectedRoute, etc.
│   │   ├── layouts/
│   │   ├── pages/              # admin, auth, events, public, user
│   │   └── utils/
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── server/                    # Backend (Node + Express)
│   ├── src/
│   │   ├── index.js            # App entry, CORS, routes, health check
│   │   ├── db.js               # Sequelize + mysql2 pool
│   │   ├── middleware/auth.js  # JWT verify, role-based authorize
│   │   ├── models/             # User, PasswordResetCode
│   │   ├── routes/             # auth, events, favorites, rsvp, upload, admin, dev
│   │   └── utils/              # jwt.js, mailer.js
│   ├── database/              # schema.sql, migrations (add_*.sql), seed_zip_locations.sql
│   ├── uploads/                # events/, hero/, profiles/ (file storage)
│   ├── .env.example
│   └── package.json
├── docs/                      # This document
└── README.md
```

## Framework & Runtime Requirements

- **Node.js:** Not specified in `package.json` (no `engines` field). Sequelize 6.x and Express 5.x typically need Node 18+.
- **npm:** Used for both client and server.
- **MySQL:** 5.7+ (or MariaDB equivalent) with utf8mb4.
- **Browser:** Modern ES modules; Leaflet for maps.

## Dependencies Summary

- **Client:** React 19, Vite 7, React Router 7, Tailwind, Leaflet. No runtime backend SDK beyond `fetch`.
- **Server:** Express 5, Sequelize, mysql2, bcrypt, jsonwebtoken, multer, nodemailer, cors, cookie-parser, dotenv. No helmet, rate-limit, or logging framework.

## Environment Variable Usage

### Server (`.env` from `.env.example`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `PORT` | No (default 5000) | Server port |
| `DB_HOST` | No (default localhost) | MySQL host |
| `DB_PORT` | No (default 3306) | MySQL port |
| `DB_NAME` | **Yes** | Database name (validated at startup) |
| `DB_USER` | No (default root) | MySQL user |
| `DB_PASSWORD` | No (default "") | MySQL password |
| `JWT_SECRET` | **Yes** | JWT signing (validated at startup) |
| `NODE_ENV` | No | Used to disable dev routes and relax cookie `secure` in jwt utils (not yet set per env) |
| `SMTP_HOST` | No | If set with SMTP_USER/SMTP_PASS, enables real email |
| `SMTP_PORT` | No (default 587) | SMTP port |
| `SMTP_USER` | No | SMTP auth |
| `SMTP_PASS` | No | SMTP auth |
| `SMTP_FROM` | No | From address for emails |

**Risk:** `.env.example` contains a real-looking password (`DB_PASSWORD=leyjoel23`). Should be placeholder only.

### Client

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_API_URL` | No (default `http://localhost:5000`) | Backend base URL; baked in at build time |

No `.env.example` in client; only `.env` (likely gitignored).

## Authentication Methods

- **Primary:** JWT in `Authorization: Bearer <token>` (client stores token in `localStorage` and sends via `getFetchOptions()`).
- **Secondary:** Same JWT in httpOnly cookie (`token`) for server-set cookie support; `authenticateToken` checks header first, then cookie.
- **JWT:** Signed with `JWT_SECRET`, expiry **7 days** (in `utils/jwt.js`).
- **Cookie:** `httpOnly: true`, `sameSite: 'lax'`, `secure: false` (hardcoded — must be `true` in production for HTTPS).
- **Roles:** `user`, `organizer`, `admin`. Registration allows `user` and `organizer` only; admin created manually or via DB.
- **Password:** bcrypt 10 rounds on register; compare on login. Password reset via OTP (6-digit code) stored hashed in `password_reset_codes`; email sent via Nodemailer (or logged to console if SMTP not configured).

## External APIs Used

| Service | Purpose | Auth |
|---------|----------|------|
| **OpenStreetMap Nominatim** | Address autocomplete (`AddressAutocomplete.jsx`), geocoding for map (`EventMap.jsx`) | None (public) |
| **OpenStreetMap tiles** | Leaflet map tiles (`{s}.tile.openstreetmap.org`) | None |

No API keys required; rate limits and usage policies of OSM apply.

## Database Structure

- **Database name:** `eventure` (from schema) or from `DB_NAME` (e.g. `eventure_db` in .env.example).
- **Tables:** `users`, `password_reset_codes`, `events`, `zip_locations`, `favorites`, `rsvps`. Table `site_settings` created at runtime in admin routes (hero background type/color/image) if not present.
- **Schema:** `database/schema.sql` (CREATE IF NOT EXISTS + helper procedures for additive columns/indexes/FKs). Additional migrations: `add_capacity_to_events`, `add_declined_status`, `add_event_images`, `add_profile_picture_and_contact_preference`, `add_tags_ticket_price_to_events`, `fix_location_column`, `fix_state_column_size`, `create_password_reset_codes`, `seed_zip_locations`.
- **ORM:** Sequelize for User (and PasswordResetCode); rest of API uses `pool` (mysql2) for raw SQL. No formal migration runner (e.g. Sequelize migrations or Flyway); changes are manual SQL scripts.

## Storage Solutions

- **File storage:** Local filesystem only. Multer writes to `server/uploads/`:
  - `uploads/events/` — event images (10 MB limit, jpeg/jpg/png/gif/webp)
  - `uploads/hero/` — admin hero background (10 MB)
  - `uploads/profiles/` — profile pictures (5 MB)
- **Serving:** Express `static` middleware serves `/uploads` (and subpaths). URLs are paths like `/uploads/events/filename.jpg`; frontend prepends `VITE_API_URL` to form full URL.
- **Production gap:** No object storage (S3, R2, etc.); no CDN. Ephemeral or single-node hosting will lose uploads on redeploy unless volume/persistent disk is used.

## Security Implementations

- **CORS:** Allowlist only: `http://localhost:5173`, `http://localhost:5174`. Production origins not configured; any other origin gets 403.
- **Auth:** JWT verification + optional cookie; role-based `authorize(['admin'])` etc. on protected routes.
- **Passwords:** Hashed with bcrypt (10 rounds); not logged.
- **Uploads:** Multer file type and size limits; extension + mimetype check (images only). No virus scan or content hash.
- **Headers:** No `helmet`; no explicit X-Frame-Options, CSP, etc.
- **Rate limiting:** None on login, register, or API.
- **Secrets:** JWT_SECRET and DB credentials from env; no vault or managed secrets.
- **Cookie:** `secure: false` in code — must be toggled for production HTTPS.
- **Dev routes:** `/api/dev/*` (e.g. test-email) mounted only when `NODE_ENV !== "production"`; returns 404 in production.

## Logging / Monitoring Setup

- **Logging:** `console.log` / `console.error` only. No log levels, no structured logger, no request ID.
- **Monitoring:** None. No APM, no health-check polling, no metrics export.
- **Health:** `GET /health` returns `{ ok: true }`; no DB or dependency check.

## Build Process

- **Client:** `npm run build` in `client/` runs `vite build`; output is `client/dist/` (default Vite). Preview: `npm run preview`.
- **Server:** No build step; Node runs `src/index.js` via `npm start` (or `npm run dev` with nodemon).
- **Env at build time:** `VITE_API_URL` must be set when running `npm run build` for production backend URL.

## Current Deployment Status

- **Codebase:** Monorepo-style (client + server in one repo); no Dockerfile, no CI/CD config, no hosting config.
- **Deployment:** Not deployed. Run locally: client on port 5173, server on 5000; DB expected on localhost.
- **Git:** Root has `.gitattributes`; only `client/.gitignore` found (node_modules, dist, etc.). Server `.env` and `uploads/` should be ignored in production (secrets and user content); recommend root or server `.gitignore` for `.env` and optionally `uploads/` (or only uploads if using persistent volume).

---

# STEP 2 — HOSTING DISCOVERY QUESTIONS

Please answer these so we can finalize the architecture and implementation plan. You can reply in short form (e.g. “Render + PlanetScale, free tier, no Docker”).

---

## HOSTING TARGET

1. **Where do you want to host?** (e.g. single provider vs. frontend on one, backend on another)
2. **Cloud provider preference?** (e.g. AWS, Azure, GCP, Vercel, Netlify, Render, Railway, DigitalOcean, Fly.io, Heroku, school-provided)
3. **Budget constraints?** (free tier only / low monthly / flexible)
4. **Expected traffic?** (class demo only / dozens / hundreds of users)
5. **Scaling expectations?** (single instance is fine / need to scale later)
6. **Region requirements?** (any / specific country or region for latency or compliance)

---

## BACKEND

7. **Does the backend need to be containerized?** (e.g. for consistency or future Kubernetes)
8. **Should we use Docker?** (yes/no; if yes, we can add Dockerfile + optional compose for local)
9. **Serverless vs traditional hosting?** (Express is long-running; serverless would require adapter and possibly different DB connection strategy — prefer to keep as Node server or open to serverless?)
10. **Load balancing?** (needed for multiple instances or not)
11. **Autoscaling?** (needed or not for this project)

---

## DATABASE

12. **What database in production?** (Keep MySQL / switch to PlanetScale, Railway MySQL, Neon Postgres, or managed RDS/Azure DB?)
13. **Managed DB or self-hosted?** (managed preferred for class project?)
14. **Migration strategy?** (run schema + migration SQL manually once, or want a migration runner / automated steps?)
15. **Backup requirements?** (daily automated backups, or acceptable to rely on provider defaults?)
16. **Connection security?** (SSL/TLS for DB connection required? Most managed DBs offer this.)
17. **ORM vs raw?** (Keep Sequelize + raw pool as-is, or simplify to one approach?)

---

## FRONTEND

18. **Static hosting or SSR?** (Current app is SPA; static hosting is sufficient unless you want SSR.)
19. **CDN usage?** (e.g. Vercel/Netlify edge, or CloudFront/Cloudflare in front — any preference?)
20. **Domain setup?** (Use provider default subdomain only, or custom domain? If custom, who manages DNS?)
21. **SSL requirements?** (HTTPS only in production — assume yes unless you say otherwise.)

---

## AUTHENTICATION & SECURITY

22. **Secrets management?** (Env vars in host only, or use a vault (e.g. AWS Secrets Manager, Doppler) later?)
23. **HTTPS enforcement?** (Redirect HTTP → HTTPS at host or in app?)
24. **CORS policies?** (Add production frontend origin(s) to allowlist — confirm exact URL(s) after you choose hosting.)
25. **Rate limiting?** (Add per-IP or per-route limits for login/register and API? Recommended for production.)
26. **Environment variable storage?** (Stored in hosting dashboard only, or also in CI for deploy?)
27. **Session handling?** (Keep JWT + optional cookie; any need for refresh tokens or shorter expiry?)
28. **OWASP / security review?** (Quick checklist only, or formal review required for class?)

---

## DEVOPS

29. **CI/CD preference?** (GitHub Actions, GitLab CI, other, or none for now?)
30. **Build automation?** (Build client on every push to main, or manual?)
31. **Testing automation?** (Any existing tests? Add unit/e2e for deploy gate?)
32. **Deployment automation?** (Auto-deploy on merge, or manual deploy?)
33. **Branching strategy?** (main only, or main + develop, or feature branches?)

---

## MONITORING

34. **Logging solution?** (Keep console only, or add file/cloud logging e.g. Papertrail, Logtail, CloudWatch?)
35. **Error tracking?** (e.g. Sentry for frontend/backend — yes/no?)
36. **Performance monitoring?** (e.g. simple uptime checks only, or APM?)
37. **Alerting?** (Email/Slack on downtime or errors — needed for class or later?)

---

# STEP 3 — PRODUCTION READINESS CHECKLIST

| Area | Item | Status |
|------|------|--------|
| **Security** | JWT secret from env and validated at startup | ✔ |
| | Passwords hashed with bcrypt | ✔ |
| | CORS allowlist (no wildcard) | ✔ |
| | Dev routes disabled in production | ✔ |
| | Upload file type and size limits | ✔ |
| | CORS includes production frontend origin(s) | ❌ (localhost only) |
| | Cookie `secure: true` when HTTPS | ❌ (hardcoded false) |
| | Rate limiting on auth and/or API | ❌ |
| | Helmet or security headers | ❌ |
| | No secrets in .env.example | ⚠ (example has real-looking password) |
| **Performance** | Health endpoint exists | ✔ |
| | DB connection pool (mysql2) | ✔ |
| | Query limit cap (e.g. events list 200) | ✔ |
| | No N+1 in critical paths (acceptable for class) | ✔ |
| | Frontend build minified (Vite default) | ✔ |
| | CDN or caching for static assets | ❌ (to be decided) |
| **Scalability** | Stateless API (JWT not server session) | ✔ |
| | File storage on local disk only | ⚠ (not multi-instance safe) |
| | DB connection limit (10) | ✔ (reasonable for single instance) |
| **Reliability** | Server validates required env on startup | ✔ |
| | DB connect before listen | ✔ |
| | Generic error handler (500) | ✔ |
| | Health check does not verify DB | ⚠ (could add DB ping) |
| | No retry logic for DB or SMTP | ⚠ (acceptable for MVP) |
| **Maintainability** | Clear client/server split | ✔ |
| | Central API base URL (VITE_API_URL) | ✔ |
| | Documented env in .env.example (server) | ✔ |
| | Node/engine version not pinned | ⚠ (recommend engines in package.json) |
| | site_settings created in code | ✔ (no missing table in schema doc) |

**Legend:** ✔ Ready | ❌ Needs change | ⚠ Risk or improvement

---

# STEP 4 — DEPLOYMENT ARCHITECTURE PLAN

## High-Level Architecture (to be refined with your answers)

```
                    [Users]
                        |
                        v
                 [ HTTPS / DNS ]
                        |
         +--------------+--------------+
         |                             |
         v                             v
  [ Frontend SPA ]              [ Backend API ]
  (Static hosting)               (Node + Express)
  - Vercel / Netlify             - Render / Railway / Fly
  - VITE_API_URL → API           - PORT, JWT_SECRET, DB_*
         |                             |
         |                             +-----> [ MySQL ]
         |                             |       (Managed e.g. PlanetScale
         |                             |        or Railway)
         |                             |
         |                             +-----> [ File storage ]
         |                                     (uploads: volume or S3 later)
         |
         +-----> [ OpenStreetMap ]
                 (Nominatim + tiles)
```

## Service Breakdown

| Service | Responsibility | Proposed (example) |
|---------|----------------|--------------------|
| **Frontend** | Serve SPA (index.html + assets), set VITE_API_URL at build | Vercel or Netlify or Render Static |
| **Backend** | REST API, auth, uploads, serve /uploads | Render Web Service or Railway |
| **Database** | MySQL for users, events, favorites, rsvps, etc. | PlanetScale / Railway MySQL / Neon (if Postgres) |
| **Storage** | Event/hero/profile images | Same server + persistent disk, or later S3/R2 |
| **Email** | Password reset, etc. | Nodemailer + SMTP (e.g. SendGrid, Brevo) via env |

## Networking

- Frontend and backend on HTTPS (provider-managed SSL).
- Frontend calls backend using `VITE_API_URL` (same-origin or cross-origin; CORS allowlist must include frontend origin).
- Backend connects to MySQL (private connection string from env; SSL if provider supports it).
- No VPC or private subnet required for minimal setup; can add later if you choose AWS/GCP.

## Storage

- **DB:** Managed MySQL; backups per provider.
- **Files:** Option A — backend host with persistent volume (Render disk, Railway volume). Option B — migrate to S3/R2 + CDN later (code changes required).

## Environment Separation

- **Development:** Local Node, local MySQL, client `npm run dev`, server `npm run dev`, CORS localhost, cookie secure false.
- **Staging (optional):** Same as prod but separate DB and env (e.g. Render preview env or second app).
- **Production:** Hosted frontend + backend + managed DB; `NODE_ENV=production`, production CORS origin(s), cookie `secure: true`, real SMTP.

## Scaling Strategy (for later)

- Single backend instance and single DB sufficient for class.
- If traffic grows: add rate limiting, then horizontal backend replicas + shared file storage (e.g. S3), then DB read replica if needed.

---

# STEP 5 — IMPLEMENTATION ROADMAP

Once you confirm hosting choices and answer the discovery questions, implementation can follow this order.

## 1. Code changes required

- **CORS:** Add production frontend URL(s) to `allowedOrigins` in `server/src/index.js` (e.g. from env `FRONTEND_URL` or hardcode after you decide).
- **Cookie:** In `server/src/utils/jwt.js`, set `secure: process.env.NODE_ENV === 'production'` (or use a small env helper).
- **.env.example:** Replace real-looking password with placeholder; add optional `FRONTEND_URL`, `NODE_ENV`, and SMTP vars if not documented.
- **Client:** Ensure build uses `VITE_API_URL` in hosting UI or CI.
- **Optional:** Add `engines` in server (and client) `package.json` (e.g. `"node": ">=18"`).
- **Optional:** Rate limiting (e.g. `express-rate-limit`) on `/api/auth/login`, `/api/auth/register`, and optionally global.
- **Optional:** Helmet in server for security headers.
- **Optional:** Health check that pings DB (e.g. `sequelize.authenticate()` in `/health`).

## 2. Infrastructure setup

- Create managed MySQL (or keep MySQL); run `schema.sql` and migrations in order; apply seed if needed.
- Create backend app (Render/Railway/etc.): connect repo, set root/build/start for `server/`, add env vars (PORT, JWT_SECRET, DB_*, NODE_ENV, optional SMTP, FRONTEND_URL).
- Create frontend app (Vercel/Netlify/Render Static): connect repo, set root/build/output to `client/` and `dist`, set `VITE_API_URL` to backend URL.
- If backend uses persistent disk for uploads, attach volume to `server/uploads` (path may differ per host).

## 3. Environment configuration

- **Backend:** PORT, NODE_ENV=production, JWT_SECRET (strong random), DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD; SMTP_* if email needed; FRONTEND_URL if CORS from env.
- **Frontend:** VITE_API_URL=https://your-backend-url (no trailing slash).
- **Secrets:** Never commit .env; use hosting dashboard or CI secrets.

## 4. CI/CD pipeline setup (if requested)

- Example: GitHub Actions on push to main — install deps, lint, build client with VITE_API_URL, (optional) run tests, trigger or deploy to hosting (per provider’s docs).
- Build matrix: build client only in CI if server is deployed separately; or build both and deploy both.

## 5. Testing strategy

- **Manual:** Register, login, create event, upload image, RSVP, admin flow, password reset (with SMTP or console fallback).
- **Optional:** Smoke test in CI (e.g. curl GET /health, or Playwright on frontend).
- **Optional:** Unit tests for auth middleware or critical utils.

## 6. Production launch checklist

- [ ] DB created and schema + migrations applied.
- [ ] Backend env set (JWT_SECRET, DB_*, NODE_ENV, CORS origin).
- [ ] Frontend built with correct VITE_API_URL and deployed.
- [ ] CORS includes production frontend URL.
- [ ] Cookie secure in production (HTTPS).
- [ ] Dev routes confirmed disabled (NODE_ENV=production).
- [ ] Health check returns 200.
- [ ] Login, register, and one full event flow tested on live URL.
- [ ] Password reset tested (if SMTP configured).
- [ ] Admin access tested; uploads and hero settings work.
- [ ] .env.example sanitized and docs updated.

---

# STEP 6 — NO CHANGES MADE YET

**This document is audit and plan only.** No code or config has been modified.  

After you:

1. **Answer the discovery questions** in Step 2, and  
2. **Confirm** that you want to proceed with implementation,  

we can:

- Apply the code changes in Step 5.1.  
- Optionally add a `docs/DEPLOYMENT.md` with your chosen hosting and copy-paste env instructions.  
- Optionally add Dockerfile(s) or CI workflow if you chose those options.  

Reply with your hosting target, answers to the questions that matter to you, and explicit confirmation to proceed with implementation.
