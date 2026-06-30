# Enterprise Nexus — API Reference

> **Base URL:** `https://your-domain.com/api`  
> **Auth:** All protected routes require `Authorization: Bearer <access_token>`  
> **Content-Type:** `application/json`

---

## Response Envelope

All endpoints return a consistent JSON envelope:

```json
{
  "success": true,
  "message": "OK",
  "data": { ... }
}
```

Errors follow the same shape with `"success": false` and an appropriate HTTP status code.

---

## Pagination

List endpoints accept `?page=1&limit=20` and return a `meta` object:

```json
"meta": { "page": 1, "limit": 20, "total": 143, "pages": 8 }
```

---

## 1 · Authentication (`/api/auth`)

| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 1 | POST | `/api/auth/register` | Public | Register a new employee account |
| 2 | POST | `/api/auth/login` | Public | Login and receive JWT access + refresh tokens |
| 3 | POST | `/api/auth/refresh` | Public | Exchange refresh token for a new access token |

### 1.1 POST /api/auth/register
```json
// Request body
{ "name": "Jane Smith", "email": "jane@acme.com", "password": "secret123" }

// 201 Response
{
  "data": {
    "user": { "id": "uuid", "name": "Jane Smith", "email": "jane@acme.com", "is_active": true }
  }
}
```

### 1.2 POST /api/auth/login
```json
// Request body
{ "email": "jane@acme.com", "password": "secret123" }

// 200 Response
{
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "user": { "id": "uuid", "name": "Jane Smith", "email": "jane@acme.com", "role": "employee" }
  }
}
```

### 1.3 POST /api/auth/refresh
```json
// Request body
{ "refresh_token": "eyJ..." }

// 200 Response
{ "data": { "access_token": "eyJ..." } }
```

---

## 2 · Users (`/api/users`)

| # | Method | Path | Auth | Role | Description |
|---|--------|------|------|------|-------------|
| 4 | GET | `/api/users/me` | ✅ | any | Get own profile |
| 5 | PUT | `/api/users/me` | ✅ | any | Update own name/email |
| 6 | PUT | `/api/users/me/password` | ✅ | any | Change own password |
| 7 | GET | `/api/users` | ✅ | admin | List all users (paginated) |
| 8 | GET | `/api/users/:id` | ✅ | admin | Get user by ID |
| 9 | PUT | `/api/users/:id` | ✅ | admin | Update user role/details/status |
| 10 | DELETE | `/api/users/:id` | ✅ | admin | Delete user account |

### 2.1 PUT /api/users/me/password
```json
{ "current_password": "old", "new_password": "newpass123" }
```

### 2.2 PUT /api/users/:id (admin)
```json
{ "name": "Jane Admin", "email": "jane@acme.com", "role": "admin", "is_active": true }
```

---

## 3 · HR Agent (`/api/hr`)

| # | Method | Path | Auth | Role | Description |
|---|--------|------|------|------|-------------|
| 11 | POST | `/api/hr/screen` | ✅ | employee+ | Screen a CV with AI |
| 12 | GET | `/api/hr/reports` | ✅ | employee+ | List own screening reports |
| 13 | GET | `/api/hr/reports/:id` | ✅ | employee+ | Get single screening report |
| 14 | GET | `/api/hr/rankings` | ✅ | employee+ | Ranked candidate list (by AI score) |

### 3.1 POST /api/hr/screen
```json
// Request body
{
  "cv_text":         "Full CV content as plain text...",
  "job_title":       "Senior Backend Engineer",
  "job_description": "We are looking for..."
}

// 201 Response
{
  "data": {
    "task_id": "uuid",
    "report": {
      "id":                 "uuid",
      "candidate_name":     "John Doe",
      "job_title":          "Senior Backend Engineer",
      "ai_score":           87.5,
      "confidence":         0.92,
      "recommendation":     "hire",
      "narrative_summary":  "Strong candidate with 8 years experience...",
      "score_breakdown":    { "technical_skills": 90, "experience": 85, "education": 80, "communication": 88, "cultural_fit": 82 },
      "extracted_profile":  { "name": "John Doe", "email": "john@example.com", "skills": ["Node.js", "PostgreSQL"], "years_experience": 8 }
    }
  }
}
```

---

## 4 · Finance Agent (`/api/finance`)

| # | Method | Path | Auth | Role | Description |
|---|--------|------|------|------|-------------|
| 15 | POST | `/api/finance/records` | ✅ | employee+ | Add expense + AI anomaly analysis |
| 16 | GET | `/api/finance/records` | ✅ | employee+ | List expense records (filterable) |
| 17 | GET | `/api/finance/dashboard` | ✅ | employee+ | Aggregated finance dashboard data |

### 4.1 POST /api/finance/records
```json
// Request body
{ "category": "Travel", "amount": 4500.00, "date": "2026-06-01", "description": "NYC client visit" }

// 201 Response
{
  "data": {
    "record": { "id": "uuid", "category": "Travel", "amount": 4500.00, "severity": "medium", "ai_analysis": "..." },
    "ai_analysis": { "severity": "medium", "is_anomaly": true, "flags": ["60% above category average"] }
  }
}
```

### 4.2 GET /api/finance/records (query params)
`?page=1&limit=20&category=Travel&date_from=2026-01-01&date_to=2026-06-30`

---

## 5 · Support Agent (`/api/support`)

| # | Method | Path | Auth | Role | Description |
|---|--------|------|------|------|-------------|
| 18 | POST | `/api/support/tickets` | ✅ | employee+ | Submit query to AI support |
| 19 | GET | `/api/support/tickets` | ✅ | employee+ | List own ticket history |
| 20 | PATCH | `/api/support/tickets/:id/status` | ✅ | employee+ | Update ticket status |

### 5.1 POST /api/support/tickets
```json
// Request body
{ "query": "I cannot access the finance module. My role seems incorrect." }

// 201 Response
{
  "data": {
    "ticket": {
      "id":          "uuid",
      "text_query":  "I cannot access the finance module...",
      "ai_response": "This appears to be a role/permissions issue. Please contact your admin...",
      "intent":      "access_request",
      "urgency":     "medium",
      "sentiment":   "negative",
      "confidence":  0.91,
      "escalated":   false,
      "status":      "open"
    }
  }
}
```

### 5.2 PATCH /api/support/tickets/:id/status
```json
{ "status": "resolved" }  // open | resolved | escalated
```

---

## 6 · Analytics Agent (`/api/analytics`)

| # | Method | Path | Auth | Role | Description |
|---|--------|------|------|------|-------------|
| 21 | GET | `/api/analytics/kpi` | ✅ | employee+ | Live KPI data (`?days=30`) |
| 22 | GET | `/api/analytics/trends` | ✅ | employee+ | 6-month performance trend |
| 23 | POST | `/api/analytics/reports` | ✅ | employee+ | Generate AI analytics report |
| 24 | GET | `/api/analytics/reports` | ✅ | employee+ | List analytics reports |

### 6.1 GET /api/analytics/kpi
```json
{
  "data": {
    "kpi": {
      "period_days": 30,
      "tasks":    { "total": 142, "completed": 138 },
      "finance":  { "total_spend": "84500.00", "anomalies": 3 },
      "support":  { "total_tickets": 27, "resolved": 24 },
      "hr":       { "cvs_screened": 18, "avg_score": "76.40" }
    }
  }
}
```

### 6.2 POST /api/analytics/reports
```json
// Request body
{ "date_period_start": "2026-05-01", "date_period_end": "2026-05-31" }
```

---

## 7 · Workflow Orchestration (`/api/workflow`)

| # | Method | Path | Auth | Role | Description |
|---|--------|------|------|------|-------------|
| 25 | POST | `/api/workflow/dispatch` | ✅ | employee+ | Dispatch task to a single agent |
| 26 | GET | `/api/workflow/tasks` | ✅ | employee+ | View task pipeline (`?agent_type=hr`) |
| 27 | GET | `/api/workflow/tasks/:id` | ✅ | employee+ | Get single task by ID |
| 28 | POST | `/api/workflow/run/:name` | ✅ | employee+ | Run a named multi-agent workflow |
| 29 | GET | `/api/workflow/definitions` | ✅ | employee+ | List available workflow definitions |

### 7.1 POST /api/workflow/dispatch
```json
// Request body
{ "agent_type": "finance", "payload": { "category": "SaaS", "amount": 999 } }
```

### 7.2 POST /api/workflow/run/:name
Available workflow names: `full_report`, `hr_then_analytics`
```json
// POST /api/workflow/run/full_report
// Request body (optional override)
{ "payload": {} }

// Response
{
  "data": {
    "workflow": "full_report",
    "results": [
      { "agentType": "hr",        "status": "fulfilled", "result": { ... } },
      { "agentType": "finance",   "status": "fulfilled", "result": { ... } },
      { "agentType": "support",   "status": "fulfilled", "result": { ... } },
      { "agentType": "analytics", "status": "fulfilled", "result": { ... } }
    ]
  }
}
```

---

## 8 · Executive Agent (`/api/executive`) — Admin Only

| # | Method | Path | Auth | Role | Description |
|---|--------|------|------|------|-------------|
| 30 | POST | `/api/executive/briefings` | ✅ | **admin** | Generate AI executive board briefing |
| 31 | GET | `/api/executive/briefings` | ✅ | **admin** | List executive briefings |
| 32 | GET | `/api/executive/briefings/:id` | ✅ | **admin** | Get single briefing |

### 8.1 POST /api/executive/briefings
```json
// Request body (optional)
{ "date": "2026-06-28" }

// 201 Response
{
  "data": {
    "report": {
      "id":            "uuid",
      "briefing_text": "Executive Summary: The organisation demonstrated strong performance...",
      "performance_summary": {
        "hr_score": 82, "finance_score": 74, "support_score": 91, "analytics_score": 79,
        "overall_health": "good"
      }
    },
    "recommendations": [
      "Increase training budget for Q3 by 15%",
      "Automate tier-1 support using AI resolution",
      "Review travel expense policy thresholds"
    ]
  }
}
```

---

## 9 · System (`/api/system`)

| # | Method | Path | Auth | Role | Description |
|---|--------|------|------|------|-------------|
| 33 | GET | `/api/system/health` | Public | any | Liveness check |
| 34 | GET | `/api/system/health/deep` | ✅ | any | Deep health (DB + AI + cache) |
| 35 | GET | `/api/system/tokens` | ✅ | **admin** | Monthly token usage + cost |
| 36 | DELETE | `/api/system/cache` | ✅ | **admin** | Evict expired AI cache entries |

### 9.1 GET /api/system/health
```json
{ "status": "ok", "uptime": 3621.4 }
```

### 9.2 GET /api/system/health/deep
```json
{
  "success": true,
  "checks": { "db": true, "ai": true, "cache": true }
}
```

### 9.3 GET /api/system/tokens
```json
{
  "data": {
    "summary": {
      "total_input_tokens":  "284500",
      "total_output_tokens": "91200",
      "total_cost_usd":      "0.195",
      "budget_usd":          50,
      "budget_remaining_usd": 49.805
    }
  }
}
```

---

## RBAC Summary

| Role | Description | Access |
|------|-------------|--------|
| `guest` | Unauthenticated | Register + Login only |
| `employee` | Authenticated user | All modules except Executive & Admin user management |
| `admin` | Administrator | Full access including Executive briefings and User management |

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request — validation error |
| 401 | Unauthorized — missing or invalid token |
| 403 | Forbidden — insufficient role |
| 404 | Not Found |
| 409 | Conflict — e.g. duplicate email |
| 429 | Too Many Requests — rate limit hit |
| 500 | Internal Server Error |
| 503 | Service Unavailable — dependency down |

---

## Quick Start

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set GEMINI_API_KEY and DB credentials

# 3. Start infrastructure
docker-compose up -d postgres

# 4. Run migrations
node src/config/migrate.js

# 5. Start the API
npm run dev
```
