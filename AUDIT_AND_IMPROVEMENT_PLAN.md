# Enterprise NeXus — Senior Engineering Audit & 5-Part Improvement Plan

**Auditor perspective:** Senior SWE, 10 yrs, enterprise systems
**Date:** 2026-07-06
**Scope:** backend/ (3,851 LOC), frontend/ (6,102 LOC), database/, supabase/, n8n-workflows/

---

## Executive Verdict

Solid CRUD platform with good engineering hygiene (JWT + refresh sessions, Joi validation, Winston + correlation IDs, Sentry, rate limiting, audit logs, graceful shutdown, real DB health check). **But the core promise of the README — a multi-agent AI OS — is not implemented.** The "AI agents" are 6 stateless single-prompt Gemini calls. There is no LangChain, no CrewAI, no AutoGen, no vector DB, no RAG, no embeddings, no Socket.io, and no cross-agent communication anywhere in the codebase.

**Overall grade: B- as a web app, D as an "AI agent" system.** The plan below closes that gap.

---

## Key Findings

### Critical (breaks the product's claims or security model)

| # | Finding | Location |
|---|---------|----------|
| C1 | **No agent orchestration.** README promises LangChain + CrewAI + AutoGen. Reality: `utils/gemini.js` has 5 one-shot prompt functions with no tools, memory, planning, or delegation. | `backend/src/utils/gemini.js` |
| C2 | **No RAG / vector search.** "Semantic Search with AI embeddings" is actually SQL `ILIKE` across 3 tables. Zero references to pgvector/embeddings in the entire repo. | `search.controller.js` |
| C3 | **RLS policies are dead code.** Policies use `auth.uid()`, but the backend connects with the **service-role key** (bypasses RLS) and issues its own JWTs (so `auth.uid()` is always NULL). Data isolation relies solely on `.eq('user_id', ...)` in every query — one missed filter = data leak. | `database/001_initial_schema.sql`, `config/supabase.js` |
| C4 | **Silent AI failure masking.** Every Gemini catch-block returns fake data (`ai_score: 50`, `severity: 'normal'`) that is **saved to the DB as if real**. A fraud transaction analyzed during an API outage is permanently marked "normal." | `utils/gemini.js` (all 5 functions) |
| C5 | **Filter injection in search.** User input is interpolated directly into PostgREST `.or(\`candidate_name.ilike.%${term}%\`)` — commas/parens in `q` can alter the filter expression. | `search.controller.js:20` |
| C6 | **Hardcoded webhook secret fallback** `'nexus-n8n-secret'` — non-timing-safe comparison, works even when env var unset (server.js requires N8N_SECRET but the fallback remains). | `webhook.controller.js:8` |

### High

- **Migration drift:** `database/001` ≠ `supabase/migrations/001` (files differ); `backend/migrations/002` re-creates `audit_logs`/`password_reset_tokens` already in 001. No single source of truth, no migration runner.
- **No real-time.** Socket.io promised (Week 09); UI uses 30-second `setInterval` polling on analytics/finance pages. Notifications are pull-only.
- **Executive "Ask AI" has no memory** — every question re-dumps 33 rows of JSON into the prompt; no conversation history, no tool use, no citation of which record supports the answer.
- **Test coverage ≈ 0.** 2 backend test files; no frontend tests; no CI gate on coverage.
- **Rate limiting disabled outside production** (`skip: () => NODE_ENV !== 'production'`) — staging/demo environments are unprotected.
- **Duplicate route mounting** (`/api/*` and `/api/v1/*`) doubles the audit/maintenance surface with no deprecation plan.

### Medium

- `gemini-1.5-flash` hardcoded in two places (utils + executive controller — the controller duplicates client setup instead of using `getModel`).
- `JSON.parse` on LLM output without schema validation (Joi is available, unused here).
- No request timeout/retry/circuit-breaker on Gemini calls.
- Uploads stored on local disk (`backend/uploads/`) — lost on redeploy; should be Supabase Storage.
- Frontend has no route-level RBAC guard (admin page fetches then fails, rather than redirecting).
- Compiled `.next/` and 1 MB PDFs committed at repo root.

---

# The 5-Part Plan

Each part is independently shippable, ordered by dependency. Estimated effort assumes 1–2 devs.

---

## Part 1 — Foundation Hardening (fix what exists) — ~1 week

Goal: make the current feature set trustworthy before adding intelligence.

1. **Consolidate migrations.** Make `supabase/migrations/` the single source; delete/regenerate `database/` and `backend/migrations/` copies; adopt `supabase db push` or a numbered runner. Add missing tables (notifications, prefs) to the canonical chain.
2. **Fix the security model.**
   - Remove dead RLS policies OR switch to Supabase Auth so `auth.uid()` works. If keeping service-role, document that isolation is app-layer and add a shared `scopedQuery(table, userId)` helper so no controller can forget `.eq('user_id')`.
   - Sanitize search input (strip `,()` or use `.textSearch()`), fix C5.
   - Remove `'nexus-n8n-secret'` fallback; use `crypto.timingSafeEqual` for the webhook secret.
   - Enable rate limiting in all environments (higher dev limit instead of skip).
3. **Stop silent AI-failure writes (C4).** Add `ai_status: 'completed' | 'failed' | 'pending'` column to hr_reports / finance_records / support_tickets. On Gemini failure, save with `ai_status='failed'` + surface a "Retry analysis" button in UI instead of fake scores.
4. **Harden Gemini plumbing.** Single client module; model name from env; 30 s timeout; 2 retries w/ exponential backoff; validate LLM JSON with Joi schemas before persisting; use Gemini's native `responseMimeType: 'application/json'` + `responseSchema` instead of regex-stripping code fences.
5. **Repo hygiene.** Remove `.next/` and course PDFs from repo root (move to documentation/ or git-lfs); pick `/api/v1` as canonical and log deprecation warnings on `/api/*` aliases.

**Exit criteria:** one migration chain applies cleanly to a fresh Supabase project; no fake AI data can be persisted; search injection test passes.

---

## Part 2 — Real AI Agent Architecture (the headline feature) — ~2 weeks

Goal: convert the 5 prompt-functions into actual agents with tools, memory, and an orchestrator — deliver the README's promise.

1. **Introduce an agent layer** `backend/src/agents/`:
   ```
   agents/
     core/agent.js        ← base: system prompt, tool loop, memory, JSON schema output
     core/orchestrator.js ← routes requests, delegates, aggregates
     core/tools.js        ← DB query tools, calculator, RAG retriever (Part 3)
     hr.agent.js  finance.agent.js  support.agent.js
     analytics.agent.js  executive.agent.js
   ```
   Use **Gemini function-calling** (`tools` in `@google/generative-ai`) — this gives a true agent loop (model decides which tool to call, backend executes, model reasons over results) without adding LangChain's Python-first weight. If a framework is required for the course rubric, use **LangChain.js** with `createToolCallingAgent`; document the choice.
2. **Give each agent tools**, e.g. Finance Agent: `query_expenses(filters)`, `get_category_stats()`, `flag_anomaly(id, severity, reason)`. HR Agent: `get_candidates()`, `compare_candidates(ids)`, `extract_cv_text(file)`.
3. **Executive Agent = orchestrator.** "Why did support costs spike?" → Executive delegates to Finance Agent + Support Agent, synthesizes both answers, returns a cited briefing. Persist each delegation as a row in the existing `tasks` table (`agent_type`, `load`, `result`) — you already built the perfect table for this.
4. **Conversation memory.** New `agent_conversations` + `agent_messages` tables; Ask-AI becomes a session-based chat (last N messages + summary in context) instead of stateless Q&A.
5. **Agent activity feed.** Every tool call logged to `audit_logs` with `agent:` prefix → powers a visible "what the agents did" timeline (great for demo/viva).

**Exit criteria:** a single question to `/api/v1/executive/ask` demonstrably triggers ≥2 sub-agent tool calls, and the response cites which records it used.

---

## Part 3 — RAG + Semantic Search (pgvector) — ~1 week

Goal: replace ILIKE search with real embeddings; give Support Agent document-grounded answers.

1. **Enable pgvector** in Supabase (`CREATE EXTENSION vector`) — no Pinecone needed; you're already on Supabase.
2. **Migration:** `documents` table (`id, user_id, title, content, chunk, embedding vector(768), source_type, source_id`) + `match_documents()` RPC (cosine similarity, per-user filter).
3. **Embedding pipeline:** use Gemini `text-embedding-004` (same API key). On create/update of hr_reports, finance_records, support_tickets, and uploaded policy docs → chunk (~500 tokens) → embed → upsert. Backfill script for existing rows.
4. **Rewire `/api/v1/search`:** embed the query → `match_documents` → return ranked, typed results; keep ILIKE as fallback when embedding fails.
5. **RAG for Support Agent:** ticket answers retrieve top-k policy/KB chunks and cite them (`sources: []` in response) — this is the "Context-Aware Customer Support with RAG" feature.
6. Add a **Knowledge Base upload UI** (reuse the CV upload modal pattern) so admins can ingest company policy PDFs/DOCX (you already have `pdf-parse` + `mammoth`).

**Exit criteria:** searching "unhappy customer refund" returns semantically related tickets that share no keywords; support responses include source citations.

---

## Part 4 — Real-Time + Workflow Completion — ~1 week

Goal: kill polling, finish the n8n loop, complete promised features.

1. **Socket.io** (or Supabase Realtime — simpler, zero server change: subscribe to `notifications` and `tasks` table changes from the client). Recommendation: **Supabase Realtime**, since the tables already exist and it removes a server dependency.
2. Replace the 30 s `setInterval` polling on analytics/finance pages with realtime subscriptions; toast on `task.status → completed/failed`.
3. **Notification triggers:** DB trigger or backend hook inserts a notification on: anomaly severity ≥ high, ticket escalated, CV shortlisted, briefing ready. Wire bell dropdown to realtime.
4. **n8n workflows end-to-end test:** each of the 5 JSON workflows imported, secrets set, and verified to call `/api/webhook/*` successfully; add a `docs/n8n-setup.md` with exact env/credential steps (currently the weakest link for a demo).
5. **Scheduled intelligence:** daily executive briefing + weekly KPI report actually fire on cron (n8n) and appear in UI without user action.

**Exit criteria:** create an anomalous transaction in one browser tab → notification + updated dashboard appear in another tab within 2 s, no refresh.

---

## Part 5 — UI Polish, RBAC, Testing & Delivery — ~1 week

Goal: make every screen functional, protected, and provable.

1. **Frontend RBAC:** route guard component reading `user.role` (admin → /admin, /security; manager → team views); hide nav items the role can't access; server returns 403 consistently.
2. **UI completeness pass** (each item = a checklist row):
   - Agent chat UI for Executive Ask-AI (conversation history, streaming responses via SSE, citation chips).
   - "Agent activity" timeline page fed by audit logs (shows Part 2's delegations — the demo centerpiece).
   - Retry-analysis buttons where `ai_status='failed'`.
   - Loading/empty/error states audit across all 21 pages (Skeleton/EmptyState components exist — apply uniformly).
   - Mobile responsiveness sweep (sidebar collapse already exists; verify tables → cards on small screens).
   - Accessibility: labels on inputs, focus traps in the 5 modals, contrast on the dark executive page.
3. **Testing to a defensible bar:**
   - Backend: supertest suites per module (auth, hr, finance, support, webhook secret, RBAC), Gemini mocked; target ~70% on controllers.
   - Frontend: Vitest + React Testing Library on auth flow, one CRUD page, api interceptor refresh logic; 1 Playwright smoke (login → create ticket → see AI fields).
   - CI: GitHub Actions gate on lint + tests; fail build on coverage drop.
4. **Ops:** move uploads to Supabase Storage; `docker-compose` verified for full local stack; `.env.example` complete for both apps; README updated to describe what's actually built (agents, RAG, realtime) with architecture diagram refresh.

**Exit criteria:** fresh clone → `docker compose up` + documented env → every nav item works for each of the 3 roles; CI green.

---

## Suggested Sequence & Effort

| Part | Focus | Effort | Depends on |
|------|-------|--------|-----------|
| 1 | Foundation & security | ~1 wk | — |
| 2 | Agent architecture | ~2 wk | 1 |
| 3 | RAG + pgvector | ~1 wk | 1 (can parallel 2) |
| 4 | Realtime + n8n | ~1 wk | 1 |
| 5 | UI/RBAC/tests/delivery | ~1 wk | 2–4 |

Total: ~6 weeks (fits the Week 08–13 roadmap window with buffer).

**If time is short, prioritize: 1 → 2 → 3.** Part 2 is what makes the project title true; Part 3 is the second-most-claimed feature; realtime (4) degrades gracefully to existing polling.
