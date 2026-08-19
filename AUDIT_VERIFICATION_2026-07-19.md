# Enterprise NeXus — Senior Engineering Audit & Verification

> **Update (same day, second audit):** a `git restore`-style operation had reverted 29 tracked files to old committed versions — this silently broke agent chat (routes unmounted), re-introduced the fake-AI-data fallback in `gemini.js`, removed LangChain deps from `backend/package.json`, and made the frontend unbuildable (`api.ts` lost `agentsApi`). All 29 files were restored from the verified snapshot; the incompatible leftover `frontend/src/hooks/useApi.ts` (old SWR generation, referenced non-existent APIs) was removed. Full gate re-run: backend lint ✅, 70/70 tests ✅, strict tsc ✅, ESLint 0 warnings ✅, build 18/18 pages ✅, runtime probes ✅ (agents + executive routes mounted and guarded, webhook 401, rate-limit headers present).
> **Caution:** avoid running `git restore .` / `git checkout -- .` in this repo — much of the new AI layer is not yet committed, so git reverts mix old and new code. Recommend committing the current working state now.

**Date:** 2026-07-19 · **Scope:** backend/ (~5,750 LOC), frontend/, supabase/, CI, n8n
**Method:** full source read + fresh install, lint, typecheck, 70-test suite, production build, and live runtime smoke tests in an isolated environment.

---

## Verdict

**The project is in genuinely good shape.** All six critical findings (C1–C6) from the 2026-07-06 audit are now resolved — five were already fixed in the codebase; the last one (C6, webhook secret) was fixed today. Every core function was verified working, either by the automated test suite or by live runtime probes.

## Verification evidence (all run today, all green)

| Gate | Result |
|---|---|
| Backend `npm install` (fresh) | ✅ 732 packages, clean |
| Backend ESLint | ✅ 0 errors |
| Backend Jest suite | ✅ **70/70 tests, 7/7 suites pass** |
| Frontend `npm install` (fresh) | ✅ 656 packages, clean |
| Frontend `tsc --noEmit` (strict mode) | ✅ 0 errors |
| Frontend ESLint | ✅ 0 errors, **0 warnings** (was 5) |
| Frontend production build | ✅ 18/18 pages compiled |
| Runtime: unknown route | ✅ 404 |
| Runtime: webhook wrong secret | ✅ 401 (timing-safe compare) |
| Runtime: agent chat without login | ✅ 401 |
| Runtime: 11 MB request body | ✅ 413 |
| Runtime: malformed JSON | ✅ 400 |
| Runtime: invalid login payload | ✅ 400 with Joi details |
| Runtime: rate-limit headers | ✅ present (now active in every env) |
| Secret scan (tree + full git history) | ✅ clean — `.env` files properly gitignored |

## What was confirmed working (function-by-function)

- **Auth:** httpOnly cookies, SHA-256-hashed refresh tokens in `user_sessions`, bcrypt-12, token rotation, session revocation on logout, account-deactivation check on every request. Frontend guards redirect unauthenticated users; admin page redirects non-admins.
- **RBAC:** every route file verified — `protect` on all API routes; `authorize('admin'|'manager')` on destructive/privileged endpoints; webhooks secret-gated.
- **AI layer:** hardened Gemini client (env model, 30 s timeout, 2 retries with backoff, native JSON schema mode). On failure records save with `ai_status='failed'` + retry endpoints — **no fake data path exists anymore** (covered by dedicated `ai.nofakedata` tests).
- **Agents:** BaseAgent tool loop (max 5 iterations, audited tool calls), 4 domain agents + Executive orchestrator with delegation, conversation memory (ownership-checked), SSE streaming with JSON fallback.
- **Data isolation:** all agent tools go through `scopedQuery` (forced `user_id` filter); search input sanitized against PostgREST filter injection (old C5).
- **Search:** semantic pgvector `match_documents` first, sanitized ILIKE fallback.
- **Error handling:** sanitized 5xx to clients, details to Winston + Sentry, correlation IDs everywhere; no empty catch blocks anywhere in the codebase.
- **CI:** lint + typecheck + test + build gates on both apps.

## Fixed today

1. **Webhook secret (old C6, critical-class):** removed the hardcoded `'nexus-n8n-secret'` fallback; comparison is now `crypto.timingSafeEqual` — `backend/src/controllers/webhook.controller.js`. Verified live: wrong secret → 401, correct secret → passes auth.
2. **Rate limiting was disabled outside production.** Now active in every environment (1000 req/15 min dev, 100 prod; skipped only under Jest) — `backend/src/server.js`. Verified live via `RateLimit-*` headers.
3. **Health check could hang** on a stalled DB connection (observed 7 s). DB ping now capped at 3 s — `backend/src/server.js`.
4. **Last 5 frontend lint warnings** removed: typed `getApiErrorMessage()` helper replaces three `catch (err: any)` blocks (`lib/api.ts`, reset-password page, CV/Finance upload modals); `useRealtimeRefresh` dependency array fixed properly instead of eslint-disable (`lib/realtime.ts`).

## Honest limitations / recommendations (non-blocking)

- **Frontend has no automated tests.** Backend is well covered; a Vitest + RTL pass on the auth flow and one CRUD page would be the highest-value next step.
- **Supabase RLS is app-layer, not DB-layer** (service-role key). This is documented and mitigated by `scopedQuery`, but a missed `.eq('user_id')` in a *new* controller is still the main data-leak class. Consider a lint rule or code-review checklist item.
- **`/api` legacy aliases** double the surface next to `/api/v1`. Fine for now; plan a deprecation.
- **Briefing cache** is an in-memory `Map` — resets on redeploy and doesn't share across instances. Fine at current scale.
- **Local `.env` holds a real service-role key + Gemini key.** Not in git (verified), but rotate them if this folder ever gets shared or synced anywhere public.

## Only you can do

- Rotate the Supabase service-role key and Gemini API key if this folder was ever shared.
- Re-run `npm install` locally in `backend/` and `frontend/` if lockfiles changed on your machine.
- Set production env vars per `backend/.env.example` when deploying.
