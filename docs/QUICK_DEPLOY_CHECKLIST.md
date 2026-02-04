# Eventure — One-Page Deploy (Free Tier)

Do these in order. Only thing you do is create 4 free accounts and paste values.

---

## Step 1 — Create 4 free accounts

| # | Service | Link | What you get |
|---|---------|------|--------------|
| 1 | **Neon** (database) | https://neon.tech | Connection string |
| 2 | **Cloudinary** (images) | https://cloudinary.com | Cloud name, API Key, API Secret |
| 3 | **Render** (backend) | https://render.com | Backend URL |
| 4 | **Cloudflare** (frontend) | https://dash.cloudflare.com → Workers & Pages | Frontend URL |

Use the same email for all if you want. No credit card for free tier.

---

## Step 2 — Neon: get DB URL + run SQL

1. In Neon: **New project** → name it `eventure` → create.
2. On the project page, copy the **Postgres** connection string (it has `?sslmode=require`). **Save it** — you’ll paste it into Render later.
3. Open **SQL Editor** in Neon.
4. Copy **all** of `server/database/postgres_bootstrap.sql` from this repo → paste in SQL Editor → **Run**.
5. (Optional) Copy **all** of `server/database/seed_zip_locations_postgres.sql` → paste → **Run**.

---

## Step 3 — Cloudinary: get 3 values

1. In Cloudinary Dashboard, note: **Cloud name**, **API Key**, **API Secret** (click Reveal).
2. **Save them** — you’ll paste them into Render in Step 5.

---

## Step 4 — Generate JWT secret (one time)

In your project folder, run:

```bash
node scripts/generate-jwt-secret.js
```

Copy the line it prints (long hex string). That’s your **JWT_SECRET** for Render.

---

## Step 5 — Render: backend

1. **Render** → **New** → **Web Service**.
2. Connect your **GitHub** (or GitLab) and select the repo that has Eventure.
3. Settings:
   - **Name:** `eventure-api` (or anything).
   - **Root directory:** `server`
   - **Build command:** `npm ci`
   - **Start command:** `npm start`
   - **Instance type:** Free
   - **Health check path:** `/health`
4. **Environment** — Add these (use “Secret” for sensitive ones):

   | Key | Value |
   |-----|--------|
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | *(paste the hex from Step 4)* |
   | `DATABASE_URL` | *(paste Neon connection string from Step 2)* |
   | `FRONTEND_URL` | Leave blank for now — you’ll add it after Step 6 |
   | `CLOUDINARY_CLOUD_NAME` | *(from Step 3)* |
   | `CLOUDINARY_API_KEY` | *(from Step 3)* Secret |
   | `CLOUDINARY_API_SECRET` | *(from Step 3)* Secret |

5. **Create Web Service**. Wait for deploy. Copy your **service URL** (e.g. `https://eventure-api.onrender.com`). No trailing slash. You’ll use it in Step 6 and 7.

---

## Step 6 — Cloudflare Pages: frontend

1. **Cloudflare** → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select the **same repo**.
3. Build settings:
   - **Project name:** `eventure` (or anything).
   - **Production branch:** `main`
   - **Root directory:** `client` ← **Must be `client`.** If this is blank, the build fails with "Could not read package.json" because the frontend lives in the `client` folder.
   - **Build command:** `npm install && npm run build`  
     *(If you prefer: `npm ci && npm run build`. No space between `&&` and the next command.)*
   - **Build output directory:** `dist`
4. **Environment variables** → **Add** (under **Build** or **Production**):
   - **Variable name:** `VITE_API_URL`
   - **Value:** *(your Render URL from Step 5, e.g. `https://eventure-api.onrender.com`)* — no trailing slash.
   - **Variable name:** `NODE_VERSION`  
   - **Value:** `20`  
     *(So Cloudflare uses Node 20; avoids old default Node causing build errors.)*
5. **Deploy command:** Leave **blank**. Do not set `npx run build` or anything here — Cloudflare deploys the `dist` folder automatically. If you set a deploy command that looks for a `build` folder, you’ll get "Cannot find module .../client/build" (Vite outputs to `dist`, not `build`).
6. **Save** and **Deploy**. Wait for build. Copy your **Pages URL** (e.g. `https://eventure.pages.dev`).

**If the build still errors:** In Cloudflare, open the failed build and copy the **error message** (the red line). Common fixes: wrong **Root directory** (`client` not blank), **Build output directory** must be `dist`, and **Build command** must be exactly `npm install && npm run build`.

---

## Step 7 — Set FRONTEND_URL on Render

1. Back in **Render** → your service → **Environment**.
2. Set **`FRONTEND_URL`** = *(your Cloudflare Pages URL from Step 6, e.g. `https://eventure.pages.dev`)* — no trailing slash.
3. **Save**. Render will redeploy; wait for it.

---

## Step 8 — Check it works

1. **Health:** Open `https://YOUR-RENDER-URL/health` in a browser. You should see `{"ok":true}`.
2. **App:** Open your Cloudflare Pages URL. Register, log in, create an event, upload an image. If those work, you’re good.

---

## First admin user (optional)

Admins aren’t created by the app; you add one in the DB.

1. In your app, **register** a normal user (e.g. your email).
2. In **Neon** → **SQL Editor**, run (replace `YOUREMAIL@example.com` with that user’s email):

```sql
UPDATE users SET role = 'admin' WHERE email = 'YOUREMAIL@example.com';
```

3. Log out and log back in. You should see **Admin** in the nav and be able to open `/admin`.

---

## Troubleshooting

- **Health returns 503** → Wrong or missing `DATABASE_URL` on Render, or Neon project paused. Fix env and redeploy.
- **CORS errors in browser** → `FRONTEND_URL` on Render must **exactly** match your Cloudflare Pages URL (no trailing slash).
- **Images don’t load after refresh** → All three `CLOUDINARY_*` env vars must be set on Render.

For more detail, see `docs/DEPLOYMENT.md`.
