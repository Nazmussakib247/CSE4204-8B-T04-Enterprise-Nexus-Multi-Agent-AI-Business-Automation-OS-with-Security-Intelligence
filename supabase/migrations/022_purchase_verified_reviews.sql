-- Reviews are tied to purchased order units. A customer may review a product
-- once per purchased unit, including multiple units in one order.
ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.ux_product_reviews_customer_product;
CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id
  ON public.product_reviews (order_id, customer_id);

