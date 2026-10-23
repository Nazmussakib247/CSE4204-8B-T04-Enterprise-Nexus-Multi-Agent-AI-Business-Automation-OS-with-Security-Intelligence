# Team Role Ownership Mind Map

This map compares files that differ between origin/main and origin/development/mid-review-before-bug-test. It classifies ownership by feature responsibility, not by Git author name. The current history records most work under one author, so this is an engineering ownership map for selective promotion.

## Visual map

~~~mermaid
mindmap
  root((Enterprise NeXus))
    Nazmus Sakib
      AI foundation
        backend/src/ai
        backend/src/agents/executive.agent.js
        backend/src/utils/gemini.js
        backend/src/utils/executiveBriefing.js
      Orchestration
        executive and analytics controllers
        task generation
        n8n executive and KPI workflows
      AI reliability
        provider failover
        retries and degradation
        structured output
      Platform governance
        auth and RBAC
        admin audit controls
        security and health checks
      Project leadership
        README
        handoff
        deployment metadata
    Shoeb Shariar Mashuk
      Backend service implementation
        REST controllers
        route wiring
        validators
        database migrations
      Commerce and recruitment APIs
        jobs
        orders
        products
        reviews
    Most Sumiya Sanjida
      Product frontend
        dashboard module pages
        public careers and store pages
        API integration
        customer flows
    Sabrina Ibrahim
      UI and frontend presentation
        modals
        layout
        auth presentation
        responsive styling
        onboarding
    Shared integration
      n8n callbacks
      Supabase migrations
      frontend API clients
      deployment configuration
~~~

## Files to promote for Nazmus's role

These are the safest first-pass files for the Team Leader and AI Integration Lead scope.

### AI foundation and orchestration

- backend/src/agents/executive.agent.js
- backend/src/ai/BaseAgent.js
- backend/src/ai/client.js
- backend/src/ai/providers.js
- backend/src/controllers/analytics.controller.js
- backend/src/controllers/aiProviders.controller.js
- backend/src/controllers/executive.controller.js
- backend/src/controllers/task.controller.js
- backend/src/routes/aiProviders.routes.js
- backend/src/routes/executive.routes.js
- backend/src/utils/gemini.js
- backend/src/utils/executiveBriefing.js
- backend/src/utils/executiveBriefingWorker.js

### Workflow automation and AI callbacks

- n8n-workflows/04-daily-executive-briefing.json
- n8n-workflows/05-weekly-analytics-kpi.json
- n8n-workflows/06-store-review-support-agent.json
- n8n-workflows/07-store-support-ai-retry.json
- n8n-workflows/job-application-screening.json
- n8n-workflows/README.md

### AI and operational database migrations

- supabase/migrations/003_agent_conversations.sql
- supabase/migrations/012_ai_provider_failover.sql
- supabase/migrations/014_add_groq_provider.sql
- supabase/migrations/017_prefer_groq_for_executive_fallback.sql
- supabase/migrations/018_executive_intelligence_briefings.sql
- supabase/migrations/019_support_conversation_runtime.sql
- supabase/migrations/020_product_review_conversations.sql
- supabase/migrations/021_production_schema_compatibility.sql
- supabase/migrations/022_purchase_verified_reviews.sql
- supabase/migrations/023_one_review_per_order.sql

### AI UI integration files

These are shared frontend integration files. They belong in the AI promotion when the corresponding Executive, Analytics, or task-orchestration experience is required:

- frontend/src/app/(dashboard)/executive/page.tsx
- frontend/src/app/(dashboard)/analytics/page.tsx
- frontend/src/components/ui/ExecutiveChat.tsx
- frontend/src/components/modals/AgentTaskModal.tsx
- frontend/src/lib/api.ts
- frontend/src/lib/auth.tsx
### Shared platform files

Include these only when promoting the related feature:

- backend/src/server.js
- backend/src/controllers/auth.controller.js
- backend/src/routes/auth.routes.js
- backend/src/validators/auth.validators.js
- backend/src/utils/email.js
- backend/src/utils/officeAutoApproval.js
- backend/src/controllers/admin.controller.js
- backend/src/routes/admin.routes.js
- backend/src/utils/supportLifecycle.js
- backend/src/controllers/support.controller.js
- backend/src/routes/support.routes.js
- backend/src/controllers/hr.controller.js
- backend/src/validators/hr.validators.js
- backend/.env.example
- HANDOFF.md
- README.md
- .vercel/README.txt
- .vercel/project.json
- .vercel/repo.json

## Files primarily in other team scopes

### Backend service and commerce

Likely Backend Developer ownership:

- backend/src/controllers/jobs.controller.js
- backend/src/controllers/orders.controller.js
- backend/src/controllers/products.controller.js
- backend/src/controllers/reviews.controller.js
- backend/src/routes/jobs.routes.js
- backend/src/routes/orders.routes.js
- backend/src/routes/products.routes.js
- backend/src/routes/reviews.routes.js
- backend/src/validators/jobs.validators.js
- backend/src/validators/orders.validators.js
- backend/src/validators/products.validators.js
- backend/src/validators/reviews.validators.js
- backend/scripts/seed-products.js
- backend/migrations/018_executive_intelligence_briefings.sql
- backend/migrations/019_office_email_otp.sql
- backend/migrations/020_public_applications_customer_otp.sql
- backend/migrations/021_support_ai_lifecycle.sql

### Frontend product

Likely Frontend Developer ownership:

- frontend/src/app/(dashboard)/dashboard/page.tsx
- frontend/src/app/(dashboard)/analytics/page.tsx
- frontend/src/app/(dashboard)/executive/page.tsx
- frontend/src/app/(dashboard)/finance/page.tsx
- frontend/src/app/(dashboard)/hr/[id]/page.tsx
- frontend/src/app/(dashboard)/support/page.tsx
- frontend/src/app/(dashboard)/support/[id]/page.tsx
- frontend/src/app/(public)/careers
- frontend/src/app/(public)/store
- frontend/src/components/store/ReviewsSection.tsx
- frontend/src/components/support/FlaggedReviewsPanel.tsx
- frontend/src/lib/mockJobs.ts
- frontend/src/lib/mockStore.ts

### UI and frontend presentation

Likely UI and Frontend Developer ownership:

- frontend/src/app/globals.css
- frontend/src/app/layout.tsx
- frontend/src/app/(auth)
- frontend/src/app/(dashboard)/admin/page.tsx
- frontend/src/app/(dashboard)/finance/page.tsx
- frontend/src/app/(dashboard)/settings/page.tsx
- frontend/src/components/auth
- frontend/src/components/hr/JobApplicationsPanel.tsx
- frontend/src/components/layout/Sidebar.tsx
- frontend/src/components/modals
- frontend/src/components/onboarding/WelcomeTour.tsx
- frontend/src/components/ui/ConfirmModal.tsx
- frontend/src/components/ui/ExecutiveChat.tsx
- frontend/src/lib/auth.tsx
- frontend/next.config.js
- frontend/tsconfig.json
- frontend/public/favicon.ico
- frontend/public/icon-192.png
- frontend/public/icon-512.png

## Dependency notes

1. frontend/src/lib/api.ts is shared and should move with the selected backend routes.
2. The Executive page and ExecutiveChat depend on the Executive API.
3. The Analytics page depends on analytics task and briefing endpoints.
4. n8n workflows depend on matching backend webhook routes and N8N_SECRET.
5. Supabase migrations must be applied in dependency order.
6. server.js, auth.controller.js, and frontend/src/lib/auth.tsx affect the whole application.
7. The current local checkout contains all files from origin/development/mid-review-before-bug-test. This map selects what to promote into main; it does not delete local files.

## Selective promotion pattern

Do not merge the entire development branch when only a role-specific slice is required. Create a temporary branch from remote main, restore selected paths from the development branch, review the diff, then commit and push.

~~~powershell
git fetch origin
git switch -C nazmus-ai-promotion origin/main
git restore --source origin/development/mid-review-before-bug-test -- backend/src/agents/executive.agent.js backend/src/ai backend/src/controllers/analytics.controller.js backend/src/controllers/aiProviders.controller.js backend/src/controllers/executive.controller.js backend/src/controllers/task.controller.js backend/src/routes/aiProviders.routes.js backend/src/routes/executive.routes.js backend/src/utils/gemini.js backend/src/utils/executiveBriefing.js backend/src/utils/executiveBriefingWorker.js n8n-workflows supabase/migrations
git diff --check
git diff --stat
~~~

Review before committing. Add shared platform files only when their related feature is included and tested.
