# Enterprise NeXus — Session Handoff

**Last updated:** 2026-09-05
**Branch:** `development/mid-review-before-bug-test`

This file exists so any future session (human or AI) can pick up context fast without re-discovering what changed. Update it whenever a meaningful change lands.

---

## Current environment (source of truth)

| Component | Where | Notes |
|---|---|---|
| Frontend | Vercel — `enterprise-nexus-delta.vercel.app` | Auto-deploys from this branch's pushes |
| Backend | Render — `enterprise-nexus-backend.onrender.com` | **Manual Deploy** required after push (branch tracking, not auto) |
| Database | Supabase project `cidfxhtrtxxpzljfwycu` | **This is the correct/current project.** An older project (`knbmuyrxgqaxvqrlsakk`) was used early on — if you ever see that URL anywhere, it's stale and wrong. |
| AI model | `gemini-3.7-flash` (`GEMINI_MODEL` env var) | Older `1.5`/`2.5` models are deprecated for this API key — always verify available models in Google AI Studio before changing this. `thinkingBudget` defaults to `0` in `ai/client.js` (see below) to keep responses fast. |
| Email | Gmail SMTP via `EMAIL_HOST=smtp.gmail.com` | Uses a Gmail **App Password**, not the real Gmail password. |

Environment variables live in **two places that must stay in sync**: Render's dashboard (production) and local `.env` / `.env.local` files (gitignored, never committed). Changing one does NOT change the other.

---

## What's built and working

### Core AI agents (pre-existing)
HR, Finance, Support, Analytics, Executive — CV screening, expense anomaly detection, ticket sentiment analysis, KPI dashboards, natural-language briefing.

### Storefront (commerce extension)
- `products` / `orders` tables (migration `005_recruitment_and_commerce.sql`)
- Public pages: `/store`, `/store/[slug]`, `/store/login`, `/store/register`, `/store/orders`, `/store/support`
- Checkout is **fully mocked** — `orders.status` is set to `'paid'` immediately, no real payment gateway
- Buying requires a `customer` account (enforced both by backend auth and proactively in the UI — the Buy button shows "Sign in to buy" instead of the quantity/checkout controls when logged out)
- Order confirmation shows an explicit "mock checkout, no real payment" note plus an order number, not just a generic toast
- `/store/orders` lets a signed-in customer track their own order statuses (pending/paid/shipped/delivered/cancelled)

### Careers / recruitment
- `job_postings` / `job_applications` tables, with **weighted skill scoring** (`required_skills` JSONB on the job, `skill_scores` JSONB on the application)
- Backend (`jobs.controller.js`) is fully built: job CRUD, CV upload + Supabase Storage, AI screening scoped to each job's skills/criteria, n8n webhook notification, and **bulk "Confirm & Notify" email** to applicants
- HR-side UI (`/hr` — Post a Job modal, `JobApplicationsPanel`) was already correctly wired to this real API
- **Public-facing `/careers` pages were NOT wired to it** — they were built against a localStorage mock (`lib/mockJobs.ts`) before the real backend was discovered. **Fixed**: `/careers`, `/careers/[id]` now call `jobsApi` directly. Added `/careers/register` for candidate signup (separate from `/store/register`'s `customer` role — applying requires a `candidate`-role account, enforced server-side in `createApplication`). `lib/mockJobs.ts` and `lib/mockStore.ts` are now dead code, safe to delete.

### Product reviews
- `product_reviews` table with `sentiment`/`urgency`/`flagged_as_complaint` columns
- Backend (`reviews.controller.js`) and the storefront submission/listing UI (`components/store/ReviewsSection.tsx`, rendered on every `/store/[slug]` page) were **already fully wired** — this was never actually missing, an earlier version of this doc wrongly listed it as pending.

### Support Agent — order-aware replies
`support.controller.js`'s `createTicket` now accepts an optional `order_id`. When present, it fetches the order + product and **injects that context into the Gemini prompt** (not just stores it in the DB), so the AI's auto-reply can reference the actual order status. `support_tickets.order_id` / `product_id` are nullable — a ticket never *requires* an order link.

### External auth
`POST /auth/register-external` — separate from the internal `/auth/register` — creates `customer` or `candidate` accounts. Cross-domain cookies use `sameSite: 'none'` in production (required because Vercel and Render are different domains); `lax` locally.

### "Already signed in" gate on auth pages
`components/auth/AlreadySignedInGate.tsx` wraps `/login`, `/register`, `/store/login`, `/store/register`, `/careers/register`. If a signed-in user lands on any of these (most commonly via the browser Back button after logging in), they see an explicit "You're already signed in as X — Go to dashboard / Sign out" card instead of the raw login/register form silently rendering underneath an active session. `logout()` in `lib/auth.tsx` now takes an optional redirect path (default `/login`) so signing out from a storefront/careers page doesn't dump you on the internal staff login.

### Storefront profile menu
`components/auth/ProfileMenu.tsx` — replaces the plain "Hi, Name / Sign out" text in the `(public)` header with a proper dropdown (avatar initial + name) containing My Orders, Support, and Sign out. Only rendered when `user` is set; logged-out visitors still see Sign in / Get started.

---

## Known gotchas / things that bit us this session

1. **Uncommitted work can vanish.** A large chunk of backend work (products/orders API, external auth, agents routing) sat uncommitted for a long time and was accidentally reverted once by a `git checkout`. **Commit early and often, even mid-feature.**
2. **Run git commands from the repo root** (`D:\00_Enterprise NeXus`), not a subfolder like `frontend/` — a wrong `git add <path>` from inside `frontend/` silently does nothing.
3. **Render doesn't auto-track branch changes.** If you change which branch Render deploys from (Settings → Build & Deploy), you must also manually trigger "Deploy latest commit" — it won't happen automatically.
4. **Docker containers on Windows can fail DNS** (Alpine base image + Docker Desktop/WSL2 flakiness) — seed scripts or any outbound call from inside a container may need a full `wsl --shutdown` + Docker Desktop restart to recover, even after adding explicit `dns:` entries in `docker-compose.yml`.
5. **Two different Supabase projects existed at once.** Local `.env` pointed at the old project long after Render had moved to the new one — always diff `SUPABASE_URL` across local `.env`, `frontend/.env.local`, and Render's dashboard when something "isn't showing up."
6. **Secrets got pasted into chat.** If you're reading this after that happened: `EMAIL_PASS`, `GEMINI_API_KEY`, `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` should have been rotated. Confirm they actually were.
7. **A hardcoded model name bypassed `GEMINI_MODEL` entirely.** `executive.controller.js`'s `askAI` used to instantiate its own `GoogleGenerativeAI` client with `model: 'gemini-1.5-flash'` hardcoded — completely separate from the hardened `ai/client.js` that HR/Finance/Support go through. When `gemini-1.5-flash` was deprecated for this API key, HR/Finance/Support kept working (they read `GEMINI_MODEL` from env) while only the Executive "Ask AI" box failed with a confusing generic error. **Fixed** by routing it through `generateJson()` from `ai/client.js` instead. Lesson: grep for `getGenerativeModel(` across the codebase if a model-related error only affects one feature — there may be a second, un-hardened code path calling Gemini directly.
8. **`gemini-3.x` models think before answering, and it's slow.** CV screening and the Executive Q&A both got noticeably slower after moving to `gemini-3.7-flash` — newer thinking-capable models spend extra hidden reasoning tokens by default. `ai/client.js`'s `generateJson()` now passes `generationConfig.thinkingConfig.thinkingBudget`, defaulted to `0` (fastest, no reasoning) in `DEFAULTS.thinkingBudget`. If a specific call needs deeper reasoning and can tolerate the latency, pass a higher `thinkingBudget` (or `null` to omit the field) as a `generateJson()` option — don't just bump the global default.

---

## Open decisions / not yet done

- Finance revenue integration: whether `orders` feeds `finance_records` (needs a `type` column) or Analytics/Executive read `orders` directly — **not decided yet**.
- Delete `frontend/src/lib/mockJobs.ts` and `frontend/src/lib/mockStore.ts` (dead code, superseded by real API wiring).
- **Recurring lesson this session: before saying a feature is "missing," grep the codebase first.** Careers pages, HR applications panel, and product reviews were each independently assumed to be unbuilt at some point in this session and turned out to already exist, fully wired, elsewhere. Don't trust this file's memory over the actual code.
