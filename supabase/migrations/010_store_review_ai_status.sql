-- Store review delivery must not depend on an AI provider being online.
-- A pending row is durable customer data and can be analysed by n8n later.
ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS ai_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ai_status IN ('pending', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_product_reviews_ai_status
  ON public.product_reviews (ai_status)
  WHERE ai_status = 'pending';

-- Existing rows were already written by the synchronous AI scanner.
UPDATE public.product_reviews
SET ai_status = 'completed'
WHERE ai_status = 'pending'
  AND (sentiment IS NOT NULL OR urgency IS NOT NULL);
