# Enterprise NeXus — Deployment Guide

## Backend → Render

### 1. Push to GitHub
```bash
git add .
git commit -m "feat: Gemini AI integration + deployment config"
git push origin main
```

### 2. Create Render Web Service
1. Go to **https://render.com** → New → Web Service
2. Connect your GitHub repo
3. Set **Root Directory** to `backend`
4. Render will auto-detect `render.yaml`

### 3. Set Environment Variables in Render Dashboard
| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | From Supabase → Settings → API |
| `JWT_SECRET` | Any random 32+ char string |
| `GEMINI_API_KEY` | From https://aistudio.google.com/app/apikey |
| `FRONTEND_URL` | Your Vercel URL (set after frontend deploy) |

### 4. Note your backend URL
After deploy it will be: `https://enterprise-nexus-backend.onrender.com`

---

## Frontend → Vercel

### 1. Create Vercel Project
1. Go to **https://vercel.com** → New Project
2. Import your GitHub repo
3. Set **Root Directory** to `frontend`

### 2. Set Environment Variables in Vercel Dashboard
| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://enterprise-nexus-backend.onrender.com/api` |

### 3. Deploy
Vercel auto-deploys on every push to `main`.

---

## After Both Are Deployed

1. Copy your Vercel URL (e.g. `https://enterprise-nexus.vercel.app`)
2. Go to Render → Environment → update `FRONTEND_URL` to that URL
3. Render will redeploy automatically

---

## Gemini API Key

1. Visit https://aistudio.google.com/app/apikey
2. Click **Create API Key**
3. Add it as `GEMINI_API_KEY` in Render

The free tier supports ~60 requests/minute which is plenty for this app.

---

## Health Check

After deploy, verify:
- Backend: `GET https://enterprise-nexus-backend.onrender.com/api/health`
- Frontend: Open your Vercel URL and login

> **Note:** Render free tier spins down after 15 min of inactivity. First request after sleep takes ~30s. Upgrade to Starter ($7/mo) to avoid cold starts.
