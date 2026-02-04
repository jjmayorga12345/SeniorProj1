# Enabling Real Email (Password Reset) on Render

Right now the app runs in **fallback mode**: when someone uses "Forgot password," the reset code is only **logged to the Render logs** and no email is actually sent.

To send real password-reset emails from your Render backend, configure SMTP by setting these environment variables in your Render service:

| Variable     | Required | Example / Notes |
|-------------|----------|------------------|
| `SMTP_HOST` | Yes      | e.g. `smtp.sendgrid.net` |
| `SMTP_PORT` | No       | `587` (default) or `465` for SSL |
| `SMTP_USER` | Yes      | SMTP username or API user (e.g. `apikey` for SendGrid) |
| `SMTP_PASS` | Yes      | SMTP password or API key |
| `SMTP_FROM` | No       | e.g. `Eventure <noreply@yourdomain.com>` |
| `SMTP_SECURE` | No    | Set to `true` for port 465 (SSL); omit for 587 |

After adding or changing these, **redeploy** the backend so the new env vars are picked up.

---

## Option A: SendGrid (free tier)

1. Sign up at [sendgrid.com](https://sendgrid.com) (free tier allows ~100 emails/day).
2. **Settings → API Keys** → Create API Key (e.g. "Eventure"), copy the key.
3. In **Render → Your backend service → Environment**, add:

   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=<paste your SendGrid API key>
   SMTP_FROM=Eventure <noreply@yourdomain.com>
   ```

   Replace `<paste your SendGrid API key>` with the key and use a valid "From" address (SendGrid may require verifying the sender/domain).

4. Save and redeploy.

---

## Option B: Resend (free tier)

1. Sign up at [resend.com](https://resend.com) (free tier available).
2. Get your SMTP credentials from the dashboard (or create an API key and use Resend’s SMTP settings).
3. In Render, set:

   ```env
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=resend
   SMTP_PASS=<your Resend API key>
   SMTP_FROM=Eventure <onboarding@resend.dev>
   ```

   Resend lets you use `onboarding@resend.dev` for testing; for production you’ll verify your own domain.

4. Save and redeploy.

---

## Option C: Other SMTP (Gmail, Mailgun, etc.)

Use your provider’s SMTP host, port, username, and password. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_FROM` in Render, then redeploy.

---

## Verify

After redeploying, check Render logs on startup. You should see either:

- `✅ SMTP verified` — real email is enabled, or  
- `⚠️ SMTP not configured...` — env vars are missing or wrong; double-check and redeploy.

Then trigger "Forgot password" on your site; the user should receive the reset code by email (and it will no longer appear only in the logs).
