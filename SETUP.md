# Proof to Profit: portal setup

Architecture: `proof2profit.site` (GitHub Pages, marketing) → "Sign in" → `app.proof2profit.site` (Cloudflare Pages, the portal) → Supabase (Google sign-in + saved data) and a Cloudflare Worker (holds the Gemini key, enforces daily limits).

Do the steps in order. Never paste secret keys into the repo or into chat.

## 1. Gemini API key (free)
1. Go to https://aistudio.google.com/apikey and create a key.
2. Keep it for step 4. Note: on Google's free tier, prompts may be used to improve Google's products, so tell users not to enter private information. Moving to a paid key later turns this off.

## 2. Supabase (database + Google sign-in)
1. Create a free project at https://supabase.com.
2. **SQL Editor** → paste all of `supabase/schema.sql` → Run.
3. **Project Settings → API**: copy the *Project URL* and the *anon public* key (these two are safe to put in `portal/config.js`).
4. **Google sign-in credentials**: in https://console.cloud.google.com create a project → *APIs & Services → OAuth consent screen* (External, add your email) → *Credentials → Create credentials → OAuth client ID → Web application*.
   - Authorized JavaScript origins: `https://app.proof2profit.site`
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Copy the Client ID and Client secret.
5. Supabase → **Authentication → Providers → Google**: enable, paste the Client ID and secret, save.
6. Supabase → **Authentication → URL Configuration**: Site URL `https://app.proof2profit.site`; add the same URL under Redirect URLs (also `http://localhost:8788` if you want to test locally).

## 3. Portal settings
Edit `portal/config.js`: fill `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and (after step 4) `API_URL`. Commit and push.

## 4. Cloudflare Worker (the API)
In a terminal, from the `worker/` folder:
```
npm install -g wrangler
wrangler login
wrangler secret put GEMINI_API_KEY      # paste the Gemini key
wrangler secret put SUPABASE_URL        # your Supabase project URL
wrangler secret put SUPABASE_ANON_KEY   # your Supabase anon key
wrangler deploy
```
The deploy prints the Worker URL (like `https://p2p-api.<you>.workers.dev`). Put it in `portal/config.js` as `API_URL`.
Limits per user per day are `DAILY_ANALYSIS_LIMIT` and `DAILY_SEARCH_LIMIT` in `worker/wrangler.toml`.

## 5. Cloudflare Pages (the portal)
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repo.
2. Build command: none. Build output directory: `portal`. Deploy.
3. **Custom domains** → add `app.proof2profit.site`. Cloudflare shows a CNAME record to add at wherever proof2profit.site's DNS is managed. Add it and wait for it to turn active.

## 6. Test
Open https://app.proof2profit.site, sign in with Google, analyze a business, save it, reload and confirm it is still there.

## Notes
- The marketing site's "Sign in" buttons already point to `https://app.proof2profit.site`.
- If you change the portal address, update `ALLOWED_ORIGINS` in `worker/wrangler.toml`, the Supabase URLs, and the Google OAuth origins.
