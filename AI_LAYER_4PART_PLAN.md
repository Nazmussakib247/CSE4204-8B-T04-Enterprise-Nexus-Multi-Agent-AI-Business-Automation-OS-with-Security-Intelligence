# AI Layer — Professional Rebuild Plan (4 Parts)

**Goal:** README-এর promise অনুযায়ী full professional AI layer — real agents (tool-calling, memory, orchestration), RAG + pgvector semantic search, cross-agent delegation, real-time agent activity.

**ব্যবহারের নিয়ম:** প্রতিটা Part-এর শেষে একটা **COMMAND PROMPT** box আছে। সেটা copy করে Claude-কে (Sonnet 5 high-effort / Fable 5) paste করলেই ওই part complete হবে। Part গুলো order-এ চালাতে হবে (1 → 2 → 3 → 4), কারণ পরের part আগেরটার উপর depend করে।

**Stack decision (সব part-এ consistent):** LangChain.js (`langchain` + `@langchain/google-genai`) — README-এ LangChain promise করা আছে, আর Node backend-এ এটাই natural fit। CrewAI Python-only, তাই CrewAI-style multi-agent orchestration LangChain.js দিয়ে implement হবে (Executive = crew manager pattern)। Vector DB = Supabase pgvector (Pinecone দরকার নেই)।

---

## Part 1 — AI Core Foundation (Agent Engine + Hardened Gemini Layer)

**কী হবে:**
- `backend/src/ai/` নামে নতুন layer: hardened Gemini client (env-configurable model, 30s timeout, 2x retry with backoff, native `responseSchema` JSON mode — regex fence-stripping বাদ)
- `BaseAgent` class: system prompt + tool-calling loop + structured output + per-call audit logging
- LangChain.js install ও integrate (`ChatGoogleGenerativeAI`)
- DB migration: `ai_status` column (`pending|completed|failed`) hr_reports, finance_records, support_tickets-এ — Gemini fail করলে fake data save হবে না, `ai_status='failed'` save হবে + retry endpoint
- পুরনো `utils/gemini.js`-এর ৫টা function নতুন engine দিয়ে rewrite (same export signature, তাই controllers ভাঙবে না)
- Joi validation সব LLM output-এ

**Acceptance:** সব existing feature (CV screening, anomaly, sentiment, analytics, invoice parse) নতুন engine-এ কাজ করে; API key invalid হলে fake score save হয় না; retry endpoint কাজ করে।

### COMMAND PROMPT — Part 1
```
Act as a senior AI engineer. In my Enterprise NeXus project, build the AI core foundation in backend/src/ai/:

1. Install langchain, @langchain/google-genai, @langchain/core in backend.
2. Create backend/src/ai/client.js — hardened Gemini access: model name from env (GEMINI_MODEL, default gemini-1.5-flash), 30s timeout, 2 retries with exponential backoff, and native JSON mode (responseMimeType + responseSchema) instead of regex code-fence stripping.
3. Create backend/src/ai/BaseAgent.js — a base agent class with: system prompt, LangChain ChatGoogleGenerativeAI, a tool-calling loop (bindTools + manual loop over tool_calls, max 5 iterations), structured JSON output validated with Joi, and every tool call written to audit_logs with action prefix "agent:".
4. Add a Supabase migration (supabase/migrations/) adding ai_status TEXT CHECK (ai_status IN ('pending','completed','failed')) DEFAULT 'completed' to hr_reports, finance_records, support_tickets.
5. Rewrite backend/src/utils/gemini.js so screenCV, detectAnomaly, analyseSentiment, generateAnalyticsReport, parseInvoice use the new ai/ layer — KEEP the same export names/signatures so controllers don't break. On AI failure: throw a typed AiUnavailableError instead of returning fake fallback data.
6. Update hr/finance/support controllers: on AiUnavailableError, save the record with ai_status='failed' and null AI fields (no fake scores), return 201 with a warning field. Add POST /api/v1/hr/reports/:id/retry-analysis, /api/v1/finance/records/:id/retry-analysis, /api/v1/support/tickets/:id/retry-analysis that re-run the AI and update the row.
7. Add Jest tests for the retry/timeout logic and the no-fake-data behavior (mock the Gemini SDK).

Do not touch frontend in this part. Run lint and tests at the end.
```

---

## Part 2 — Five Specialized Agents with Real Tools

**কী হবে:**
- `backend/src/agents/`: hr, finance, support, analytics — প্রতিটা `BaseAgent` extend করে, নিজস্ব **tools** পাবে (Gemini function-calling):
  - **HR Agent:** `query_candidates`, `compare_candidates`, `get_hiring_stats`, `rescreen_candidate`
  - **Finance Agent:** `query_expenses`, `get_category_stats`, `detect_anomalies_batch`, `flag_transaction`
  - **Support Agent:** `query_tickets`, `get_sentiment_trends`, `escalate_ticket`, `draft_reply`
  - **Analytics Agent:** `get_kpi_snapshot`, `compute_module_stats`, `generate_report`
- সব DB tool এক shared `scopedQuery` helper দিয়ে — user_id filter কখনো miss হবে না
- প্রতিটা agent-এর জন্য chat endpoint: `POST /api/v1/agents/:agent/chat` — model নিজে decide করবে কোন tool call করবে
- Agent tool-call trace response-এ ফেরত আসবে (`steps: [{tool, args, result_summary}]`) — UI-তে "agent thinking" দেখানোর জন্য

**Acceptance:** "compare my top 3 candidates for the frontend role" জিজ্ঞেস করলে HR agent নিজে `query_candidates` → `compare_candidates` call করে data-grounded উত্তর দেয়, আর response-এ tool steps থাকে।

### COMMAND PROMPT — Part 2
```
Act as a senior AI engineer. Building on backend/src/ai/BaseAgent.js in my Enterprise NeXus project, create four real tool-calling agents:

1. Create backend/src/agents/tools/scopedQuery.js — a helper that wraps supabase queries and ALWAYS applies .eq('user_id', userId). All agent tools must use it.
2. Create backend/src/agents/hr.agent.js, finance.agent.js, support.agent.js, analytics.agent.js. Each extends BaseAgent with a domain system prompt and LangChain tools (zod schemas):
   - HR: query_candidates(filters), compare_candidates(ids[]), get_hiring_stats(), rescreen_candidate(id)
   - Finance: query_expenses(filters), get_category_stats(period), detect_anomalies_batch(), flag_transaction(id, severity, reason)
   - Support: query_tickets(filters), get_sentiment_trends(), escalate_ticket(id), draft_reply(ticket_id)
   - Analytics: get_kpi_snapshot(), compute_module_stats(module), generate_report()
   Write-action tools (flag, escalate, rescreen) must also write an audit_logs entry.
3. Add POST /api/v1/agents/:agent/chat (JWT-protected) accepting { message }. It runs the matching agent's tool loop and returns { answer, steps: [{tool, args, result_summary}] }.
4. Register route in server.js under v1 only.
5. Frontend: add agentsApi.chat(agent, message) to src/lib/api.ts, and on each of the HR, Finance, Support, Analytics pages add an "Ask <X> Agent" panel (collapsible card): input + answer + an expandable "Agent steps" trace showing which tools were called. Follow the existing Tailwind design tokens used in those pages.
6. Add supertest coverage for /agents/:agent/chat with mocked LLM verifying the tool loop executes and user scoping holds.

Run lint and tests at the end.
```

---

## Part 3 — Executive Orchestrator + Conversation Memory (Multi-Agent)

**কী হবে:**
- **Executive Agent = orchestrator** (CrewAI manager pattern, LangChain.js-এ): এর tools হলো অন্য ৪টা agent (`delegate_to_hr`, `delegate_to_finance`, `delegate_to_support`, `delegate_to_analytics`) + `synthesize_briefing`
- Cross-domain প্রশ্নে executive নিজে ভেঙে sub-agent-দের delegate করে, তারপর synthesize করে — প্রতিটা delegation existing `tasks` table-এ row হিসেবে save (agent_type, load, result) → demo-তে দেখানোর মতো trace
- **Conversation memory:** নতুন `agent_conversations` + `agent_messages` tables; Ask-AI stateless থেকে session-based chat হবে (last 10 messages + rolling summary context-এ)
- `/api/v1/executive/ask` rewrite → conversation_id support + **SSE streaming** response
- Frontend: Executive page-এ full chat UI — history, streaming answer, delegation trace ("Executive → Finance Agent → query_expenses") 
- Daily briefing generation-ও orchestrator দিয়ে (সব agent থেকে summary নিয়ে synthesize)

**Acceptance:** "Why did costs spike and is support affected?" জিজ্ঞেস করলে executive ≥2 sub-agent delegate করে, tasks table-এ delegation rows দেখা যায়, উত্তর streaming আসে, follow-up প্রশ্নে আগের context মনে থাকে।

### COMMAND PROMPT — Part 3
```
Act as a senior AI engineer. In my Enterprise NeXus project, convert the Executive agent into a true multi-agent orchestrator with memory:

1. Migration: create agent_conversations (id, user_id, title, summary, created_at, updated_at) and agent_messages (id, conversation_id, role CHECK ('user','assistant','tool'), content, metadata JSONB, created_at).
2. Create backend/src/agents/executive.agent.js extending BaseAgent. Its tools are the other four agents: delegate_to_hr(question), delegate_to_finance(question), delegate_to_support(question), delegate_to_analytics(question) — each runs that agent's tool loop and returns its answer. Every delegation inserts a row into the existing tasks table (agent_type, load={question}, result={answer}, status='completed') so delegations are traceable.
3. Rewrite POST /api/v1/executive/ask: accepts { question, conversation_id? }. Loads last 10 messages + conversation summary as context, runs the orchestrator, persists user+assistant messages, updates the rolling summary. Respond via SSE streaming (text/event-stream) with events: token, delegation (when a sub-agent is called), done (with conversation_id and delegation list). Keep a non-streaming JSON fallback if Accept header isn't event-stream.
4. Add GET /api/v1/executive/conversations and GET /api/v1/executive/conversations/:id/messages.
5. Rewire the daily briefing (getDailyBriefing + the n8n webhook path) to use the orchestrator: gather each agent's domain summary via delegation, then synthesize.
6. Frontend: rebuild the Executive page's Ask-AI section into a chat UI — conversation list sidebar, message history, streaming rendering via fetch + ReadableStream, and delegation chips shown inline (e.g. "→ Finance Agent"). Match the page's existing dark design.
7. Tests: orchestrator delegation with mocked sub-agents; conversation memory persistence.

Run lint and tests at the end.
```

---

## Part 4 — RAG + pgvector Semantic Search + Live Agent Activity

**কী হবে:**
- Supabase-এ **pgvector** enable; `documents` table (chunk + `embedding vector(768)`) + `match_documents()` RPC (cosine, per-user)
- **Embedding pipeline:** Gemini `text-embedding-004`; hr/finance/support record create/update-এ auto-embed; existing data-র backfill script
- **Knowledge Base:** admin policy PDF/DOCX upload (existing `pdf-parse` + `mammoth` reuse) → chunk → embed
- `/api/v1/search` rewrite: query embed → `match_documents` → ranked semantic results (ILIKE fallback রাখা হবে) — filter injection (C5)-ও fix হয়ে যাবে
- **Support Agent RAG:** ticket reply-তে top-k KB chunk retrieve + **citations** (`sources: []`) — README-র "Context-Aware Customer Support with RAG"
- সব agent-এ shared `search_knowledge(query)` tool
- **Supabase Realtime:** tasks + notifications table subscribe → polling বাদ; নতুন **Agent Activity page** — audit_logs থেকে live timeline (কোন agent কী tool চালালো) — demo centerpiece

**Acceptance:** keyword মিল ছাড়াও semantically related result আসে; support answer-এ policy citation থাকে; এক tab-এ anomaly ঢোকালে অন্য tab-এ ২ সেকেন্ডে notification + activity timeline update — refresh ছাড়া।

### COMMAND PROMPT — Part 4
```
Act as a senior AI engineer. In my Enterprise NeXus project, add RAG with Supabase pgvector, semantic search, and realtime agent activity:

1. Migration: CREATE EXTENSION IF NOT EXISTS vector; documents table (id, user_id, title, content, chunk_index, embedding vector(768), source_type CHECK ('hr','finance','support','knowledge_base'), source_id, created_at) with an ivfflat cosine index; match_documents(query_embedding, match_count, p_user_id) RPC returning ranked chunks.
2. Create backend/src/ai/embeddings.js using Gemini text-embedding-004 (same API key): embedText, chunkText (~500 tokens with overlap), upsertDocument, and a backfill script backend/scripts/backfill-embeddings.js for existing hr_reports, finance_records, support_tickets.
3. Hook embedding upserts into the hr/finance/support create+update controller paths (fire-and-forget with error logging; never block the response).
4. Knowledge base: POST /api/v1/admin/knowledge (admin-only, multer) accepting PDF/DOCX, extract with existing pdf-parse/mammoth utils, chunk, embed, store with source_type='knowledge_base'; plus GET list and DELETE endpoints.
5. Rewrite GET /api/v1/search: embed the query, call match_documents, map to typed results (type/title/subtitle/link like the current shape); keep sanitized ILIKE as fallback if embedding fails. This also fixes the current PostgREST .or() injection — sanitize any remaining ILIKE input.
6. RAG in Support Agent: add a retrieve_knowledge(query) tool that returns top-5 chunks; draft_reply must ground answers in retrieved chunks and return sources: [{title, snippet}]. Also add retrieve_knowledge to the Executive orchestrator's toolset.
7. Frontend: (a) admin Knowledge Base section on the admin page (upload + list + delete); (b) show source citation chips on support ticket AI replies; (c) replace the 30s setInterval polling on analytics and finance pages with Supabase Realtime subscriptions on tasks/notifications (use NEXT_PUBLIC_SUPABASE_URL + anon key); (d) new /activity page under (dashboard): live agent activity timeline fed by audit_logs entries with the "agent:" prefix, updating in realtime.
8. Tests: match_documents mapping, search fallback, RAG citation presence.

Update README's tech stack table to reflect reality (LangChain.js, pgvector, Supabase Realtime). Run lint and tests at the end.
```

---

## Order & Dependency

| Part | Focus | Depends on | আনুমানিক সময় (AI-assisted) |
|------|-------|-----------|------------------------------|
| 1 | AI core engine + no-fake-data | — | 1 session |
| 2 | ৪টা tool-calling agent + chat | 1 | 1–2 sessions |
| 3 | Executive orchestrator + memory + streaming | 2 | 1–2 sessions |
| 4 | RAG + semantic search + realtime activity | 1–3 | 1–2 sessions |

**Tips:** প্রতি part শেষে manually test করে তারপর পরের command দাও। কোনো part-এ কিছু ভাঙলে পরের command-এর আগে লিখো: "First verify Part N acceptance criteria pass, fix anything broken, then proceed."
