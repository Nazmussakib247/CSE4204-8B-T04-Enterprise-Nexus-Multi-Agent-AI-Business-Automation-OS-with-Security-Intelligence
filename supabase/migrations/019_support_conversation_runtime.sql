-- Support lifecycle fields used by the API.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_response TEXT,
  ADD COLUMN IF NOT EXISTS sentiment TEXT,
  ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS escalated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS human_intervention_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS human_intervention_reason TEXT,
  ADD COLUMN IF NOT EXISTS human_intervention_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS human_response TEXT,
  ADD COLUMN IF NOT EXISTS human_response_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS human_response_at TIMESTAMPTZ;

-- Conversation messages are required by both customer and staff support pages.
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'staff', 'ai')),
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created
  ON public.support_messages(ticket_id, created_at ASC);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_messages FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
