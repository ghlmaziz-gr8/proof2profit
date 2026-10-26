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

## Roles

Run `supabase/roles.sql` once (done on the live project). Roles: super user (everything), admin, sales, business owner, team member.
- Super user: invites anyone, changes roles, removes anyone (except themselves).
- Admin: sees all invitations; invites and removes sales people and business owners.
- Sales: invites business owners and sees only their own invitations.
- Business owner: adds up to 5 team members (managers, marketing); sees only their own team.
- Team member: no invite rights.
The invite list is only reachable through role-checked database functions, so owners and members cannot read it.

## Share by email
Run `supabase/share.sql` once in the Supabase SQL editor. It adds `share_report(...)`, which builds a clean read-only email (single analysis or comparison) on the server and queues it in `email_outbox`; the existing Worker cron sends it. Limits: 5 recipients per share, 30 emails per person per day. Portal side: `portal/share.js`.

## Website SEO check
- Worker endpoint `/seo` fetches a public homepage (SSRF-guarded: public http/https hosts only, ports 80/443, 6 redirects, 1.5 MB cap) and returns facts. Scoring lives in `portal/seo.js`. Limit: `DAILY_SEO_LIMIT` (default 20/day per user). Needs no new secrets; paste the updated `worker/src/index.js` into the p2p-api editor.

## Social profile reader (`/social`)
The Worker route `/social` reads public profile stats where a platform allows it (TikTok works; Instagram and Facebook block Cloudflare, YouTube and X show no stats). Anything blocked falls back to numbers typed in the portal. Optional variable: `DAILY_SOCIAL_LIMIT` (default 30 per user per day).

## Choosing the AI engine (admins)
1. Run `supabase/ai_config.sql` once in the Supabase SQL editor.
2. Update the Worker with the latest `worker/src/index.js` (it needs the existing `OUTBOX_SECRET` secret, which also encrypts the saved key).
3. Sign in as an admin or super user, open your profile, tap **AI engine**, pick a provider, type the model name, paste the API key, tap **Test**, then **Save**.

Providers built in: Google Gemini, OpenAI, Anthropic Claude, Mistral, Groq, DeepSeek, xAI Grok, Perplexity, OpenRouter, and **Custom** (any https address that speaks the OpenAI, Anthropic or Gemini format). To add a vendor permanently, add one line to `PROVIDERS` in the Worker. Model names are free text, so new models need no update.
The key is encrypted in the Worker and stored as ciphertext; browsers never receive it. Web-search lookups (review search, social research) work only with Gemini; other engines skip them. "Use platform default" returns to the Gemini key set as a Worker secret.
