# Proof to Profit: how it is deployed

```
proof2profit.site (GitHub Pages: marketing site, index.html)
   |  "Sign in"
   v
app.proof2profit.site (Cloudflare Pages project "p2p-portal": portal/ files)
   |-- Supabase: Google sign-in, kv table (saved reports), invite list, daily usage limits
   '-- Cloudflare Worker "p2p-api": holds the Gemini key, checks the user, calls Gemini
```

## Pieces
- **Marketing site**: `index.html` + `CNAME` in this repo, served by GitHub Pages at proof2profit.site.
- **Portal**: `portal/index.html`, `portal/config.js`, `portal/shim.js`. Deployed with Cloudflare Pages *Direct Upload*:
  zip these three files flat (no folder inside) and upload at Workers & Pages -> p2p-portal -> Create deployment.
  Custom domain `app.proof2profit.site` is a CNAME at GoDaddy pointing to `p2p-portal.pages.dev`.
- **Worker**: `worker/src/index.js`, pasted into the Cloudflare editor for `p2p-api` (not Git-connected).
  Settings: `ALLOWED_ORIGINS`, `DAILY_ANALYSIS_LIMIT`, `DAILY_SEARCH_LIMIT`, `GEMINI_MODEL` (currently `gemini-flash-lite-latest`),
  secrets `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- **Supabase**: run `supabase/schema.sql`, then `supabase/invite_only.sql`. Enable Google under Authentication -> Providers.
  Add `https://app.proof2profit.site/` to Authentication -> URL Configuration -> Redirect URLs.

## Notifications and email
- In-app: `supabase/notifications.sql` (profiles, notifications bell, preferences, delete-my-data). UI in `portal/extras.js`.
- Email: `supabase/email.sql` (outbox queue, triggers, weekly summary via pg_cron). The Worker's `scheduled()` handler (cron every 5 min)
  claims queued emails and sends them through Resend. Worker secrets: `RESEND_API_KEY`, `OUTBOX_SECRET`; its SHA-256 hash is in `app_secrets`.
- Resend domain proof2profit.site is verified with DNS records at GoDaddy (TXT `resend._domainkey`, CNAME `rsend`, CNAME `send`). Sender: noreply@proof2profit.site.

## Access (invite-only for now)
Only emails in `public.allowed_emails` can analyze or save. Add a user: Supabase -> Table Editor -> allowed_emails -> Insert row
(their Google email). Remove: delete the row. For paid access later, add/remove rows from a payment webhook.

## Notes
- Gemini free tier: Google may use prompts to improve its products, and Google Search grounding ("Find competitors" live search)
  is not available on the free quota; the app falls back to general knowledge and says so.
- Gemini models change often. If analysis fails with a model error, change `GEMINI_MODEL` in the Worker settings.
- Google OAuth consent screen must be **In production** for non-test users to reach the invite check.
