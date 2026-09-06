-- Durable human-support lifecycle for customer tickets and product reviews.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS human_intervention_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS human_intervention_reason TEXT,
  ADD COLUMN IF NOT EXISTS human_intervention_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (human_intervention_status IN ('not_required', 'pending', 'handled')),
  ADD COLUMN IF NOT EXISTS human_response TEXT,
  ADD COLUMN IF NOT EXISTS human_response_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS human_response_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_support_tickets_human_queue
  ON public.support_tickets (human_intervention_status, created_at DESC)
  WHERE human_intervention_status = 'pending';

ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS human_intervention_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS human_intervention_reason TEXT,
  ADD COLUMN IF NOT EXISTS human_intervention_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (human_intervention_status IN ('not_required', 'pending', 'handled')),
  ADD COLUMN IF NOT EXISTS support_reply TEXT,
  ADD COLUMN IF NOT EXISTS support_replied_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS support_replied_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_product_reviews_human_queue
  ON public.product_reviews (human_intervention_status, created_at DESC)
  WHERE human_intervention_status = 'pending';
