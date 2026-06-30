# Enterprise Nexus API

Multi-Agent AI Business Automation OS — REST API backend.

## Project Structure

```
enterprise-nexus/
├── src/
│   ├── agents/
│   │   ├── BaseAgent.js          # Gemini wrapper: caching, token tracking
│   │   ├── HRAgent.js            # CV screening & candidate scoring
│   │   ├── FinanceAgent.js       # Expense analysis & anomaly detection
│   │   ├── SupportAgent.js       # Intent classification & RAG response
│   │   ├── AnalyticsAgent.js     # KPI reports & trend insights
│   │   └── ExecutiveAgent.js     # 5-step chain-of-thought synthesis
│   │
│   ├── orchestrator/
│   │   └── orchestrator.js       # Sequential, parallel & named workflows
│   │
│   ├── config/
│   │   ├── db.js                 # pg Pool connection
│   │   ├── migrate.js            # DDL — creates all tables
│   │   └── seed.js               # (optional) demo seed data
│   │
│   ├── middleware/
│   │   ├── auth.js               # JWT authenticate + RBAC authorize
│   │   ├── sanitize.js           # XSS input sanitisation
│   │   └── errorHandler.js       # Global express error handler
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Task.js
│   │   ├── HR.js
│   │   ├── Finance.js
│   │   ├── Support.js
│   │   ├── Analytics.js
│   │   └── Executive.js
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── hrController.js
│   │   ├── financeController.js
│   │   ├── supportController.js
│   │   ├── analyticsController.js
│   │   ├── executiveController.js
│   │   ├── workflowController.js
│   │   └── systemController.js
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── hr.js
│   │   └── modules.js            # finance, support, analytics, workflow, executive, system
│   │
│   ├── utils/
│   │   ├── logger.js             # Winston structured logger
│   │   ├── jwt.js                # Sign/verify access + refresh tokens
│   │   ├── response.js           # success/error/paginate helpers
│   │   ├── aiCache.js            # PostgreSQL-backed AI response cache
│   │   └── tokenTracker.js       # Per-call token & cost recording
│   │
│   ├── app.js                    # Express app (middleware + routes)
│   └── server.js                 # HTTP server startup
│
├── logs/                         # Winston log output
├── uploads/                      # Multer file staging
├── Dockerfile
├── docker-compose.yml
├── package.json
├── .env.example
└── API_REFERENCE.md              # Full endpoint documentation
```

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express.js 4 |
| Database | PostgreSQL 16 (via `pg` pool) |
| AI | Google Gemini 1.5 Flash |
| Auth | JWT (access + refresh) |
| Containers | Docker + Docker Compose |
| Logging | Winston |
| Security | Helmet, CORS, express-rate-limit, xss |

## Roles

- `guest` — unauthenticated (register/login)
- `employee` — all agent modules
- `admin` — employee + executive briefings + user management

See `API_REFERENCE.md` for the full endpoint catalogue (36 endpoints).
