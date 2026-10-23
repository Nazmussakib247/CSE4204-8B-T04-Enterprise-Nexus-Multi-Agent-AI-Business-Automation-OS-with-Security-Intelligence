# Enterprise NeXus — n8n Workflows

n8n is the **workflow automation engine** for Enterprise NeXus. It handles scheduled AI generation, multi-step alerts, and autonomous agent actions that the backend can't do on its own.

---

## Architecture

```
Backend (Express)
    │
    ├── POST → n8n Webhook     (when HR/Finance/Support records created)
    │
    └── GET  ← n8n HTTP Request (n8n polls /api/webhook/pending-tasks for scheduled workflows)
                │
                ├── Calls Gemini AI directly
                ├── Calls backend APIs to read data
                └── POSTs results back to /api/webhook/* endpoints
```

---

## The 7 Workflows

| # | File | Trigger | What it does |
|---|------|---------|--------------|
| 01 | `01-hr-shortlist-pipeline.json` | Webhook (backend push) | Receives HR report → if shortlisted, schedules interview + notifies |
| 02 | `02-finance-anomaly-alert.json` | Webhook (backend push) | Receives high/critical transaction → formats & logs alert |
| 03 | `03-support-auto-escalation.json` | **Every 1 hour** (cron) | Polls pending support tasks → escalates old high-urgency tickets |
| 04 | `04-daily-executive-briefing.json` | **Every day at 8:00 AM** | Fetches all agent data → calls Gemini → saves executive report |
| 05 | `05-weekly-analytics-kpi.json` | **Every Monday at 9:00 AM** | Fetches HR+Finance+Support stats → calculates KPI → Gemini insights → saves analytics report |
| 06 | `06-store-review-support-agent.json` | Webhook (new product review) | Analyses review sentiment/urgency, saves it, and posts a customer-visible Support Agent reply |
| 07 | `07-store-support-ai-retry.json` | Webhook (only after AI outage) | Retries a saved failed support-ticket analysis and restores its AI reply/escalation state |

---

## Setup

### 1. Self-host n8n (recommended for dev)
```bash
npx n8n
# Opens at http://localhost:5678
```
Or use [n8n Cloud](https://app.n8n.cloud) (free tier available).

### 2. Import workflows
1. Open n8n → Workflows → Import
2. Import each `.json` file from this folder
3. You'll see all 7 workflows imported

### 3. Set n8n Environment Variables
In n8n → Settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `NEXUS_API_URL` | `http://localhost:5000/api` (dev) or `https://enterprise-nexus-backend.onrender.com/api` (prod) |
| `N8N_SECRET` | Same value as `N8N_SECRET` in your backend `.env` |
| `GEMINI_API_KEY` | Your Google AI Studio API key |

### 4. Set backend `.env`
```env
N8N_WEBHOOK_URL=http://localhost:5678/webhook    # or your n8n cloud URL
N8N_SECRET=change-me-to-a-random-secret
```

### 5. Activate workflows
- Open each workflow in n8n
- Click **Activate** (top-right toggle)
- Webhook workflows are instantly live
- Scheduled workflows will fire at their configured times

---

## How webhooks work (Workflows 01 & 02)

```

## Store customer-care workflows (06 & 07)

`06-store-review-support-agent.json` runs for every product review. It persists sentiment/urgency and publishes a safe Support Agent reply to the exact review. Negative or high-urgency results are also placed in the dashboard human-intervention queue.

`07-store-support-ai-retry.json` runs only if the backend could not reach Gemini while creating a support ticket. The ticket is already saved with `ai_status = failed`; n8n restores the same sentiment, urgency, intent, AI response, and escalation state through a protected callback.

Both inbound n8n webhooks verify `x-nexus-secret`, and both callbacks require the same secret. Keep all three values identical: backend `N8N_SECRET`, n8n `$env.N8N_SECRET`, and the Render environment variable.

### Required activation order

1. Set `NEXUS_API_URL`, `N8N_SECRET`, `GEMINI_API_KEY`, and optional `GEMINI_MODEL` in n8n.
2. Set backend `N8N_WEBHOOK_URL` to the n8n production webhook base URL (without the trailing workflow path).
3. Import workflows 06 and 07 and activate them.
4. Submit a product review. It should gain a Support Agent reply after the n8n run.
5. To test 07, temporarily make the backend Gemini configuration unavailable, submit a ticket, restore the configuration, and confirm the saved ticket gains its AI response after n8n receives the retry webhook.
1. User submits CV / Finance record in the frontend
2. Backend saves to Supabase + calls Gemini AI
3. Backend fires POST to n8n webhook URL (fire & forget)
4. n8n receives the payload and runs the workflow nodes
5. n8n POSTs result back to /api/webhook/task-update
```

## How scheduled workflows work (Workflows 03, 04, 05)

```
1. n8n cron triggers at configured time
2. n8n calls GET /api/webhook/pending-tasks to pick up any user-requested tasks
3. n8n fetches live data from backend APIs (HR stats, Finance summary, Support report)
4. n8n calls Gemini API with a structured prompt
5. n8n POSTs the generated report back to /api/webhook/executive-briefing or /api/webhook/analytics-kpi
6. Report appears in the frontend (Executive or Analytics page)
```

---

## Triggering a KPI or Briefing Manually (from Frontend)

The Analytics and Executive pages have task-creation buttons. When a user clicks **"Generate KPI"** or **"Generate Briefing"**, the frontend calls `POST /api/tasks` with the relevant `agent_type`. The next time the scheduled n8n workflow runs, it picks up this pending task, processes it for that specific user, and saves the result.

---

## n8n Variables Reference

| n8n variable | Description |
|---|---|
| `$env.NEXUS_API_URL` | Base URL of the backend API |
| `$env.N8N_SECRET` | Shared secret for backend → n8n and n8n → backend auth |
| `$env.GEMINI_API_KEY` | Google AI Studio key for direct Gemini calls from n8n |
| `$json` | Current node's output data |
| `$('Node Name').first().json` | Output from a specific previous node |
