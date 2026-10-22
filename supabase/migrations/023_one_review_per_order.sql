-- A quantity of five is still one purchase review. A separate order for the
-- same product receives its own review and remains independently editable.
ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

-- Remove the old one-review-per-product restriction. The API enforces one
-- review per purchased order while allowing separate orders to be reviewed.
DROP INDEX IF EXISTS public.ux_product_reviews_customer_product;

CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id
  ON public.product_reviews (order_id, customer_id);
