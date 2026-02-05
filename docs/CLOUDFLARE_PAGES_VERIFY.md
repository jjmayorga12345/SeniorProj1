# If Discussion/Reviews don’t show (even in incognito)

If you don’t see **Discussion** or **Reviews** on event pages (and incognito doesn’t help), the live site is still serving an **old frontend build**. Fix it by making sure Cloudflare Pages builds and deploys the latest code.

## 1. Check what’s deployed

1. Open **Cloudflare Dashboard** → **Workers & Pages** → your **Eventure** project.
2. Open the **Deployments** tab.
3. Look at the **latest deployment**:
   - **Commit message** – Is it from after you added Discussion/Reviews (e.g. “Reviews, discussion, follow organizers…”)?
   - **Status** – **Success** (green) or **Failed** (red)?

If the latest deploy is **Failed**, the site is still showing the previous successful (old) build. Fix the build (see below), then redeploy.

If the latest deploy is **Success** but the commit is old, Cloudflare isn’t building from your latest pushes. Check:
- **Production branch**: Settings → Builds & deployments → **Production branch** = `main` (or whatever branch you push to).
- **Repo**: The connected repo is the one you’re pushing to (e.g. Leynadth/Eventure).

## 2. Build settings (must match)

In **Settings** → **Builds & deployments** → **Build configuration**:

| Setting | Value |
|--------|--------|
| **Root directory** | `client` |
| **Build command** | `npm install && npm run build` |
| **Build output directory** | `dist` |

If **Root directory** is blank or wrong, the build can fail or build the wrong app, and you won’t see the new Discussion/Reviews.

## 3. Trigger a new deploy

1. Push your latest code to the branch Cloudflare uses (e.g. `main`).
2. In Cloudflare Pages → **Deployments** → **Create deployment** (or **Retry deployment** on the latest commit).
3. Wait until the new deployment shows **Success**.
4. Open your **live Pages URL** (the one under “View build” / “Visit site”) and hard refresh (Ctrl+Shift+R).

## 4. Confirm the right URL

Use the **production** URL from the latest **successful** deployment (e.g. `https://eventure.pages.dev` or your custom domain). Preview URLs from old or failed builds will show old content.

---

After a **successful** deploy from the correct branch with **Root directory** = `client`, the event detail page will show **Discussion** and **Reviews** sections on the page (and the Details | Discussion | Reviews tabs).
