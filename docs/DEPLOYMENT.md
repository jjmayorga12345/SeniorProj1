# Eventure — Production Deployment (Free Tier)

**Stack:** Cloudflare Pages (frontend) · Render (backend) · Neon Postgres · Cloudinary (uploads)

---

## Environment variables checklist

**Render (backend)** — set these in Render Dashboard → Service → Environment:

| Variable | Required | Example / Notes |
|----------|----------|------------------|
| `NODE_ENV` | Yes | `production` |
| `JWT_SECRET` | Yes | Long random string (e.g. `openssl rand -hex 32`) |
| `DATABASE_URL` | Yes | Neon Postgres connection string with `?sslmode=require` |
| `FRONTEND_URL` | Yes | Cloudflare Pages URL, no trailing slash (e.g. `https://eventure.pages.dev`) |
| `CLOUDINARY_CLOUD_NAME` | Yes (for uploads) | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | Yes (if using Cloudinary) | From Cloudinary, mark as Secret |
| `CLOUDINARY_API_SECRET` | Yes (if using Cloudinary) | From Cloudinary, mark as Secret |
| `PORT` | No | Leave empty; Render sets it |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | No | Optional email (password reset, etc.) |

**Cloudflare Pages (frontend)** — set in Cloudflare Dashboard → Pages → project → Settings → Environment variables:

| Variable | Required | Example / Notes |
|----------|----------|------------------|
| `VITE_API_URL` | Yes (prod) | Render backend URL, no trailing slash (e.g. `https://eventure-api.onrender.com`) |

---

## Render settings (exact)

| Setting | Value |
|---------|--------|
| **Root directory** | `server` |
| **Build command** | `npm ci` |
| **Start command** | `npm start` |
| **Health check path** | `/health` |
| **Instance type** | Free |

---

## Cloudflare Pages settings (exact)

| Setting | Value |
|---------|--------|
| **Root directory** | `client` |
| **Build command** | `npm ci && npm run build` |
| **Build output directory** | `dist` |
| **Environment variable** | `VITE_API_URL` = your Render backend URL (no trailing slash) |

SPA fallback: ensure `client/public/_redirects` contains `/*    /index.html   200` so client-side routing works.

---

## Final verification checklist

After deploy, run through:

- [ ] **Health:** Open `https://<your-render-url>/health` → response `{ "ok": true }`. If 503, DB is unreachable.
- [ ] **Register / login:** From the Cloudflare Pages URL, register a user and log in. Log out and log in again. Auth works with Bearer token and cookie.
- [ ] **Create event:** As organizer, create an event. Confirm it appears in the list.
- [ ] **Upload image:** Upload an event image (or hero/profile). Refresh the page and confirm the image still loads (Cloudinary persists after redeploy).
- [ ] **Favorites:** Add an event to favorites; remove it. List and state persist.
- [ ] **RSVP:** RSVP “going” to an event; cancel RSVP. State persists.
- [ ] **Admin hero:** If you have an admin user, open `/admin`, view stats, and update hero background (color or image). Reload and confirm hero settings persist.
- [ ] **Profile picture:** Upload a profile picture; confirm it shows in the nav and persists after refresh.

---

## 1. Neon Postgres (Database)

1. Go to [neon.tech](https://neon.tech) and create a free account.
2. Create a new project (e.g. `eventure`). Choose a region close to your Render region.
3. Copy the **connection string** from the dashboard (Connection string → **Postgres**). It looks like:
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. In Neon SQL Editor (or any Postgres client connected to this DB), run the bootstrap script:
   - Open `server/database/postgres_bootstrap.sql` from this repo.
   - Copy its contents and run them in the Neon SQL Editor.
5. (Optional) Seed ZIP codes for radius search:
   - Open `server/database/seed_zip_locations_postgres.sql`.
   - Run its contents in the Neon SQL Editor.

**Migrations:** For future schema changes, run SQL in Neon SQL Editor or use a migration tool. The app does not run migrations automatically.

---

## 2. Cloudinary (Image / file uploads)

1. Go to [cloudinary.com](https://cloudinary.com) and create a free account.
2. In the Dashboard, note:
   - **Cloud name**
   - **API Key**
   - **API Secret** (click “Reveal”)
3. You will pass these to the backend as env vars (see Render section).

---

## 3. Render (Backend)

1. Go to [render.com](https://render.com) and sign in (e.g. with GitHub).
2. **New → Web Service**.
3. Connect your GitHub repo and select the repository that contains Eventure.
4. **Settings:**
   - **Name:** `eventure-api` (or any name).
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start` (or `node src/index.js`)
   - **Instance Type:** Free

5. **Environment variables** (Add all; use “Secret” for sensitive values):

   | Key | Value | Notes |
   |-----|--------|--------|
   | `NODE_ENV` | `production` | Required |
   | `PORT` | (leave empty or `10000`) | Render sets PORT automatically |
   | `JWT_SECRET` | (generate a long random string) | e.g. `openssl rand -hex 32` |
   | `DATABASE_URL` | (Neon connection string) | From Neon step 3, with `?sslmode=require` |
   | `FRONTEND_URL` | `https://your-project.pages.dev` | Your Cloudflare Pages URL (no trailing slash) |
   | `CLOUDINARY_CLOUD_NAME` | (from Cloudinary) | |
   | `CLOUDINARY_API_KEY` | (from Cloudinary) | Mark as Secret |
   | `CLOUDINARY_API_SECRET` | (from Cloudinary) | Mark as Secret |

   Optional (email):
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

6. **Health Check Path:** `/health`  
   Render will ping this to verify the app is up. The app returns 200 only when the DB is reachable.

7. Deploy. After deploy, note the **service URL**, e.g. `https://eventure-api.onrender.com`. Use this as the frontend API base URL.

---

## 4. Cloudflare Pages (Frontend)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select the same GitHub repo.
3. **Build settings:**
   - **Project name:** e.g. `eventure`
   - **Production branch:** `main` (or your default branch)
   - **Root directory:** `client`
   - **Framework preset:** None (or Vite if available)
   - **Build command:** `npm ci && npm run build`
   - **Build output directory:** `dist`

4. **Environment variables** (Settings → Environment variables):
   - **Variable name:** `VITE_API_URL`
   - **Value:** Your Render backend URL, e.g. `https://eventure-api.onrender.com`  
   - No trailing slash.  
   - Apply to **Production** (and Preview if you want).

5. **SPA fallback (React Router):**
   - In **Settings → Builds & deployments → Build configuration**, add a **Custom build command** if needed; the important part is the output directory `dist`.
   - For client-side routing, in **Settings → Functions and assets**, ensure **Single-page application** is enabled (or add a `_redirects` / `_routes` or `404.html` handling per Cloudflare Pages docs for SPAs).  
   - Cloudflare Pages: create a `client/public/_redirects` file with:
     ```
     /*    /index.html   200
     ```
   So all routes serve `index.html` and React Router handles the path.

6. Deploy. Note the **Pages URL**, e.g. `https://eventure.pages.dev`. This is your **FRONTEND_URL**; set it in Render env vars if not already.

---

## 5. Post-deploy checklist

- [ ] **Backend:** Open `https://your-render-url.onrender.com/health` → `{ "ok": true }`.
- [ ] **Frontend:** Open your Cloudflare Pages URL → Eventure home page loads.
- [ ] **CORS:** Register, log in, and use the app from the Pages URL (no CORS errors).
- [ ] **Auth:** Register a user, log in, log out. Then log in again.
- [ ] **Events:** Create an event (as organizer), add an image (upload should go to Cloudinary). Refresh the page and confirm the image still loads (persists).
- [ ] **Favorites / RSVP:** Add a favorite, RSVP to an event; confirm they appear and persist.
- [ ] **Admin:** If you have an admin user, open `/admin`, check stats and hero settings. Upload a hero image; confirm it persists after refresh.
- [ ] **Profile picture:** Upload a profile picture; confirm it shows in nav and persists.

---

## 6. Local verification (before deploy)

1. **Backend (Postgres + env):**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env: set DATABASE_URL (Neon connection string), JWT_SECRET, FRONTEND_URL=http://localhost:5173, CLOUDINARY_* if you want Cloudinary
   npm ci
   npm run dev
   ```
   - Visit `http://localhost:5000/health` → `{ "ok": true }`.

2. **Bootstrap DB (if not already):**
   - Run `server/database/postgres_bootstrap.sql` in Neon SQL Editor.
   - Optionally run `server/database/seed_zip_locations_postgres.sql`.

3. **Frontend:**
   ```bash
   cd client
   # Create .env with VITE_API_URL=http://localhost:5000
   npm ci
   npm run dev
   ```
   - Open `http://localhost:5173`. Register, login, create event, upload image, favorites, RSVP. Confirm images persist (local uploads or Cloudinary per your .env).

---

## 7. Env var reference

| Variable | Where | Required | Description |
|----------|--------|----------|-------------|
| `VITE_API_URL` | Client (build time) | No (default localhost:5000) | Backend base URL for API and image URLs |
| `NODE_ENV` | Server | No | `production` on Render |
| `PORT` | Server | No | Set by Render |
| `JWT_SECRET` | Server | Yes | Long random string for JWT signing |
| `DATABASE_URL` | Server | Yes (prod) | Neon Postgres connection string with `?sslmode=require` |
| `FRONTEND_URL` | Server | Yes (prod) | Cloudflare Pages URL for CORS |
| `CLOUDINARY_CLOUD_NAME` | Server | Yes (prod for uploads) | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Server | Yes (if using Cloudinary) | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Server | Yes (if using Cloudinary) | Cloudinary API secret |
| `SMTP_*` | Server | No | Optional email (password reset, etc.) |

---

## 8. Troubleshooting

- **Health returns 503:** DB unreachable. Check `DATABASE_URL`, Neon project is not suspended, and IP/SSL allow access.
- **CORS errors in browser:** Ensure `FRONTEND_URL` on Render exactly matches the Cloudflare Pages URL (scheme + host, no trailing slash).
- **Images 404 after deploy:** If using Cloudinary, ensure all three `CLOUDINARY_*` vars are set on Render. If not using Cloudinary, images are served from server disk and will be lost on redeploy (use Cloudinary for production).
- **Login/cookie not persisting:** Backend must use HTTPS and `secure: true` cookies (set when `NODE_ENV=production`). Render and Cloudflare both use HTTPS.
