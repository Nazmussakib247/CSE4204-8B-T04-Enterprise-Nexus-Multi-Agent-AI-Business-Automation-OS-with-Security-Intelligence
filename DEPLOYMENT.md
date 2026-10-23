# Enterprise NeXus Deployment Guide

This document describes the supported local and hosted deployment setup for Enterprise NeXus.

## Deployment architecture

- **Frontend:** Next.js application hosted on Vercel.
- **Backend:** Node.js and Express API hosted on Render.
- **Database:** PostgreSQL, Realtime, Storage, and pgvector hosted on Supabase.
- **Automation:** n8n workflows are stored in `n8n-workflows/` and can run locally with Docker or on a managed n8n instance.
- **AI:** Gemini is the primary provider. Groq is used when configured as a fallback provider.

### Hosted URLs

| Service | URL |
| --- | --- |
| Public application | https://enterprise-nexus-delta.vercel.app |
| Store | https://enterprise-nexus-delta.vercel.app/store |
| Backend API | https://enterprise-nexus-backend.onrender.com |
| Backend health check | https://enterprise-nexus-backend.onrender.com/api/health |

## Local development with Docker

### Prerequisites

- Docker Desktop with Docker Compose
- Supabase project credentials
- Gemini API key

### Configure environment files

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Fill in the values before starting the stack. Keep `.env` and `.env.local` private; they are ignored by Git.

The local stack exposes:

| Service | Address |
| --- | --- |
| Frontend | http://localhost:3000 |
| Backend | http://localhost:5000 |
| API health | http://localhost:5000/api/health |
| n8n | http://localhost:5678 |

Start and stop the stack with the root-level scripts:

```powershell
.\start.bat
.\stop.bat
```

The n8n data volume is preserved when the stack is stopped. Use `docker compose down -v` only when you intentionally want to remove local n8n data.

## Supabase database setup

The canonical migration source is:

```text
supabase/migrations/
```

Run the migrations with the Supabase CLI from the repository root:

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Do not recreate a separate root `database/` folder or copy these files into another migration directory. The migration sequence must be applied once, in filename order.

## Backend deployment on Render

The backend configuration is in `backend/render.yaml`.

### Render service settings

- **Service type:** Web Service
- **Root directory:** `backend`
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Health check path:** `/api/health`
- **Auto-deploy:** Disabled for the stable hosted version; deploy manually after reviewing a commit.

### Required Render environment variables

Set these in Render's Environment settings. Never commit their values.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access |
| `SUPABASE_ANON_KEY` | Supabase public API key |
| `JWT_SECRET` | Session token signing secret |
| `JWT_EXPIRES_IN` | Access token lifetime, for example `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime, for example `7d` |
| `GEMINI_API_KEY` | Primary Gemini provider key |
| `GEMINI_MODEL` | Optional Gemini model override |
| `GROQ_API_KEY` | Optional fallback provider key |
| `GROQ_MODEL` | Optional Groq model override |
| `N8N_SECRET` | Shared webhook secret |
| `N8N_WEBHOOK_URL` | n8n webhook base URL, when enabled |
| `FRONTEND_URL` | Production Vercel origin |
| `FRONTEND_ORIGINS` | Optional comma-separated approved origins |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` | SMTP delivery settings |
| `EMAIL_FROM` | Sender address |
| `ESCALATION_EMAIL` | Support escalation recipient |

After saving environment changes, use Render's **Manual Deploy** action and verify `/api/health`.

## Frontend deployment on Vercel

### Vercel project settings

- **Framework:** Next.js
- **Root directory:** `frontend`
- **Build command:** `npm run build`
- **Install command:** `npm install`

Set the following Vercel environment variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `/api` |
| `BACKEND_API_ORIGIN` | `https://enterprise-nexus-backend.onrender.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, optional for Realtime |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key, optional for Realtime |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional Sentry DSN |

Deploy manually after reviewing the production commit. Confirm that the frontend can load the backend health endpoint and sign in successfully.

## Release checklist

1. Review the intended commit and confirm that no secrets or local environment files are included.
2. Apply pending files from `supabase/migrations/` with `supabase db push`.
3. Deploy the backend on Render and confirm `/api/health` returns a healthy response.
4. Deploy the frontend on Vercel.
5. Confirm `FRONTEND_URL` and CORS origins match the Vercel domain exactly.
6. Verify sign-in, HR application screening, finance anomaly detection, support replies, and executive pages.
7. Check Render logs and the browser console for errors after deployment.

## Troubleshooting

- **First request is slow:** Render's free instance may sleep after inactivity. An external health monitor can call `/api/health`, but it cannot remove the free-tier limitations.
- **CORS error:** Check `FRONTEND_URL` and `FRONTEND_ORIGINS` in Render.
- **AI unavailable:** Check `GEMINI_API_KEY`; configure `GROQ_API_KEY` if fallback is required.
- **Database schema error:** Confirm that every migration in `supabase/migrations/` has been applied once.
- **n8n workflow failure:** Check `N8N_WEBHOOK_URL`, `N8N_SECRET`, and the corresponding workflow activation state.
