# Local verification (exact commands)

Run from repo root.

## 1. Backend (Postgres + env)

```bash
cd server
copy .env.example .env
# Edit .env: set DATABASE_URL (Neon connection string), JWT_SECRET, FRONTEND_URL=http://localhost:5173
# Optional: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET for Cloudinary uploads
npm ci
npm run dev
```

In another terminal:

```bash
curl -s http://localhost:5000/health
```

Expected: `{"ok":true}`

## 2. Database bootstrap (once)

- Open Neon SQL Editor (or any Postgres client with your DATABASE_URL).
- Run contents of `server/database/postgres_bootstrap.sql`.
- Optionally run `server/database/seed_zip_locations_postgres.sql`.

## 3. Frontend

```bash
cd client
# Create .env with: VITE_API_URL=http://localhost:5000
npm ci
npm run dev
```

Open http://localhost:5173 in a browser.

## 4. Manual checks

- Register a user → Log in → Log out → Log in again.
- Create an event (as organizer), upload an image. Refresh; image should still show (local path or Cloudinary URL).
- Add favorite, RSVP. Confirm they persist.
- If admin: open /admin, check stats; upload hero image; confirm it persists.
