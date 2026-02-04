# Live verification checklist (after deploy)

Use this after deploying to Cloudflare Pages + Render + Neon + Cloudinary.

- [ ] **Health:** Open `https://<your-render-url>/health` → `{"ok":true}`.
- [ ] **Frontend:** Open Cloudflare Pages URL → Eventure home loads; no console errors.
- [ ] **Register:** Create a new account → success.
- [ ] **Login:** Log in → redirect/dashboard; token/cookie works.
- [ ] **Protected routes:** Visit /dashboard, /my-events, /favorites without being logged out.
- [ ] **Create event:** As organizer, create an event with title, description, category, date, image.
- [ ] **Upload image:** Upload event image → success; image URL is Cloudinary (starts with https://res.cloudinary.com).
- [ ] **Persist image:** Refresh the page → event image still loads (persists across redeploys).
- [ ] **Favorites:** Add event to favorites → list shows it; refresh → still there.
- [ ] **RSVP:** RSVP to an event → status shows; refresh → still going.
- [ ] **Admin (if applicable):** Log in as admin → /admin loads; stats; upload hero image → refresh → hero image persists.
- [ ] **Profile picture:** Upload profile picture → appears in nav; refresh → still there.
- [ ] **CORS:** No "blocked by CORS" errors when using the live frontend URL.
