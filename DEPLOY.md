# 🚀 Deploy Guide — Supabase + Vercel + GitHub

Free hosting for the ask-her-out site: **GitHub** (code) → **Vercel** (site + API) → **Supabase** (database).
Total cost: $0. Time: ~15 minutes.

---

## Architecture

```
GitHub repo (this project)
   └── Vercel
         ├── frontend  → Vite static site (her phone 💕)
         └── api/index.py → FastAPI serverless function (/api/*)
               └── Supabase Postgres (answers table)
```

---

## Step 1 — Create the Supabase project & table

1. Go to **https://supabase.com** → **Start your project** → sign in with GitHub.
2. **New project** → name it (e.g. `ask-her-out`), pick a region near you, set a DB password (save it somewhere).
3. When the dashboard opens, click **SQL Editor** (left sidebar) → **New query**.
   Open the **`supabase.sql`** file in this repo, copy **all of it** (it's pure SQL — no markdown), paste, and **Run**. It creates the `answers` table with row-level-security policies that allow anyone to insert and read answers, nothing else.

   > ⚠️ Copy only the contents of `supabase.sql` — not this guide. Markdown headings like `# 🚀 Deploy Guide` will fail with a syntax error.

4. Get your credentials: **Project Settings → API**:
   - **Project URL** → this is `SUPABASE_URL`
   - **anon public** key → this is `SUPABASE_KEY`

   (The anon key is public-facing and safe to expose — writes are limited to inserting answers by the policies above.)

## Step 2 — Push the code to GitHub

```bash
git init
git add .
git commit -m "Ask her out site with Supabase + Vercel"
```

Then on **https://github.com/new**:
1. Create a repo (name it anything, e.g. `ask-her-out`) — Private is fine.
2. Do **not** initialize with a README.
3. Back in the terminal, run the commands GitHub shows you, e.g.:

```bash
git remote add origin https://github.com/<your-username>/ask-her-out.git
git branch -M main
git push -u origin main
```

## Step 3 — Import the project into Vercel

1. Go to **https://vercel.com** → sign in with GitHub.
2. **Add New… → Project** → select your `ask-her-out` repo → **Import**.
3. Vercel auto-detects Vite. Set:
   - **Framework Preset:** Vite
   - **Root Directory:** leave blank (the repo root)
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Output Directory:** `frontend/dist`
4. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL from Step 1 |
   | `SUPABASE_KEY` | your anon key from Step 1 |

5. Click **Deploy**. ☕ ~1 minute later you get a URL like `https://ask-her-out.vercel.app`

> **Note:** this project uses a `vercel.json` with explicit routes, so the
> Build Command / Output Directory settings above are what Vercel expects for
> the static build. Don't change the Root Directory.

## Step 4 — Test it 🎉

1. Open your Vercel URL → check `https://<your-app>.vercel.app/api/health`
   — it should say `"storage": "supabase"`.
2. Open the site, tap the envelope, say **Yes**, pick a date idea.
3. In Supabase → **Table Editor → answers** — her answer is right there. 💘

## Local development

```bash
# Terminal 1 — API (uses data/answers.json unless SUPABASE_URL/KEY are set)
backend/venv/Scripts/python.exe -m uvicorn api.index:app --port 8001

# Terminal 2 — frontend (proxies /api → localhost:8001)
cd frontend && npm run dev
```

Optional: to test the Supabase path locally, create `api/.env`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJ...
```

## Troubleshooting

- **`/api/health` says `local-file`** → env vars missing on Vercel; re-check Step 3.4 (add them, then **Redeploy**).
- **500 on `/api/answer`** → the `answers` table or RLS policies from Step 1.3 don't exist; re-run the SQL.
- **CORS errors in the browser console** → add your Vercel URL to `ALLOWED_ORIGINS` env var on Vercel: `https://<your-app>.vercel.app`.
- **Build fails** → make sure the Build Command is exactly `cd frontend && npm install && npm run build`.
