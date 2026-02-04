# Eventure — Production Deployment Plan & File Change List

**Hosting:** Cloudflare Pages (frontend) | Render (backend) | Neon Postgres | Cloudinary (uploads)

---

## STEP 1 — READ-ONLY AUDIT OUTPUT

### A) Table-by-table schema spec (from schema.sql + migrations)

| Table | Columns |
|-------|---------|
| **users** | id (BIGINT PK), email (VARCHAR 255 UNIQUE), password_hash (VARCHAR 255), first_name, last_name, role (ENUM admin/organizer/user), created_at, updated_at, profile_picture (VARCHAR 500 NULL), show_contact_info (TINYINT 1 default 0) |
| **password_reset_codes** | id (BIGINT PK), user_id (BIGINT FK users), code_hash (VARCHAR 255), expires_at (DATETIME), used_at (DATETIME NULL), created_at |
| **events** | id (BIGINT PK), title, description, starts_at, ends_at, venue, address_line1, address_line2, city, state (VARCHAR 50), zip_code, location (VARCHAR 500 NULL), lat, lng, category, status (ENUM pending/approved/declined), is_public (TINYINT 1), created_by (FK users), created_at, updated_at, capacity (INT NULL), tags (VARCHAR 500 NULL), ticket_price (DECIMAL 10,2 default 0), main_image, image_2, image_3, image_4 (VARCHAR 500 NULL) |
| **zip_locations** | zip_code (VARCHAR 10 PK), lat, lng, city, state, created_at |
| **favorites** | id (BIGINT PK), user_id (FK users), event_id (FK events), created_at; UNIQUE(user_id, event_id) |
| **rsvps** | id (BIGINT PK), user_id (FK users), event_id (FK events), status (ENUM going/maybe/not_going), created_at, updated_at; UNIQUE(user_id, event_id) |
| **site_settings** | id (INT PK), setting_key (VARCHAR 100 UNIQUE), setting_value (TEXT), updated_at; created at runtime in adminRoutes |

### B) File upload endpoints and frontend consumption

| Endpoint | Method | Auth | Storage | Response | Frontend use |
|----------|--------|------|---------|----------|--------------|
| /api/upload/event-image | POST | Yes | uploads/events/ | { url: "/uploads/events/...", filename } | Event create/edit: stores url in main_image, image_2–4; display via getImageUrl(path) or path.startsWith("http") |
| /api/upload/hero-image | POST | Admin | uploads/hero/ | { url: "/uploads/hero/...", filename } | Admin hero settings; stored in site_settings |
| /api/upload/profile-picture | POST | Yes | uploads/profiles/ | { url: "/uploads/profiles/...", filename }; updates users.profile_picture | NavBar, MyAccount, EventDetails organizer |

Frontend: `getImageUrl(imagePath)` = `imagePath.startsWith("http") ? imagePath : API_URL + imagePath`. So storing full Cloudinary URLs requires no frontend change.

### C) Environment variables currently used

| Variable | Where read | Required |
|----------|------------|----------|
| PORT | server/src/index.js | No (default 5000) |
| DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME | server/src/db.js | Yes for MySQL (replaced by DATABASE_URL for Postgres) |
| JWT_SECRET | server/src/index.js, jwt.js, auth middleware, eventsRoutes (jwt.verify) | Yes |
| NODE_ENV | server/src/index.js (dev routes), jwt (cookie secure), mailer, adminRoutes (error detail) | No |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM | server/src/utils/mailer.js | No (fallback logs to console) |
| VITE_API_URL | client (api.js, pages, NavBar) at build time | No (default localhost:5000) |

---

## PLAN + FILE CHANGE LIST

### New files
- `server/database/postgres_bootstrap.sql` — Postgres schema (tables, indexes, FKs)
- `server/database/seed_zip_locations_postgres.sql` — Seed zip_locations (optional)
- `docs/DEPLOYMENT.md` — Exact hosting setup (Cloudflare, Render, Neon, Cloudinary)
- `.gitignore` (root) — Ignore server/.env

### Modified files
- `server/src/db.js` — DATABASE_URL, Postgres Sequelize + pg pool; pool.execute() wrapper (? → $n, result normalization)
- `server/src/index.js` — CORS (FRONTEND_URL + localhost), trust proxy, helmet, rate-limit (auth), express json limit, /health DB check, remove static /uploads (or keep for dev)
- `server/src/utils/jwt.js` — secure: process.env.NODE_ENV === 'production'
- `server/src/routes/uploadRoutes.js` — Cloudinary upload (memory multer), return Cloudinary URL; profile update with URL
- `server/src/routes/authRoutes.js` — pool.execute → same API; handle pg unique_violation for ER_DUP_ENTRY
- `server/src/routes/eventsRoutes.js` — pool.execute; INSERT events add RETURNING id; use rows[0].id for eventId; pg error codes
- `server/src/routes/favoritesRoutes.js` — pool.execute; result.affectedRows → rowCount
- `server/src/routes/rsvpRoutes.js` — pool from db; pool.execute; creator comparison String(); affectedRows
- `server/src/routes/adminRoutes.js` — pool.execute; site_settings Postgres (SERIAL, ON CONFLICT); DATE_FORMAT → to_char
- `server/package.json` — Add pg, helmet, express-rate-limit, cloudinary; remove mysql2
- `server/.env.example` — Placeholders only; add DATABASE_URL, FRONTEND_URL, CLOUDINARY_*

### Not changed (by design)
- Client: no UI, routes, or feature changes; image URLs work with full Cloudinary URLs via existing startsWith("http")
- Server: auth, events, favorites, rsvp, admin behavior unchanged; only DB dialect, upload storage, CORS, and hardening

---

## Endpoint list (reference)

- GET/POST /api/auth/register, /api/auth/login, /api/auth/logout
- POST /api/auth/forgot-password, /api/auth/reset-password-with-code, /api/auth/verify-reset-code, /api/auth/reset-password
- GET /api/auth/profile, PUT /api/auth/profile
- POST /api/auth/change-password-request, /api/auth/change-password
- POST /api/auth/delete-account-request, DELETE /api/auth/delete-account
- GET /api/events, GET /api/events/categories, GET /api/events/my, GET /api/events/attending, GET /api/events/:id
- POST /api/events, PUT /api/events/:id, DELETE /api/events/:id
- GET/POST/DELETE /api/favorites, GET /api/favorites/check/:eventId, DELETE /api/favorites/:eventId
- POST/DELETE/GET /api/rsvp/:eventId
- POST /api/upload/event-image, /api/upload/hero-image, /api/upload/profile-picture
- GET /api/admin/settings/hero, PUT /api/admin/settings/hero, GET /api/admin/stats, GET/PUT/DELETE /api/admin/events, GET/DELETE /api/admin/users, GET /api/admin/analytics, etc.
- GET /health
