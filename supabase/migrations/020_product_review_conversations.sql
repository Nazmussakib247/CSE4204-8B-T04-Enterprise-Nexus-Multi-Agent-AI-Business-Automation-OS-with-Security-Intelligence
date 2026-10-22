-- Product reviews follow the usual marketplace model: one review per
-- customer/product, with an editable review and an unbounded reply thread.
WITH duplicate_reviews AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY customer_id, product_id
           ORDER BY created_at DESC, id DESC
         ) AS row_number
  FROM public.product_reviews
)
DELETE FROM public.product_reviews review
USING duplicate_reviews duplicate
WHERE review.id = duplicate.id
  AND duplicate.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_product_reviews_customer_product
  ON public.product_reviews (customer_id, product_id);

CREATE TABLE IF NOT EXISTS public.product_review_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'staff', 'ai')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_review_messages_review
  ON public.product_review_messages (review_id, created_at);

ALTER TABLE public.product_review_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads review messages" ON public.product_review_messages;
CREATE POLICY "Anyone reads review messages" ON public.product_review_messages
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Customers write own review messages" ON public.product_review_messages;
CREATE POLICY "Customers write own review messages" ON public.product_review_messages
  FOR INSERT WITH CHECK (
    sender_type = 'customer'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.product_reviews review
      WHERE review.id = review_id AND review.customer_id = auth.uid()
    )
  );
