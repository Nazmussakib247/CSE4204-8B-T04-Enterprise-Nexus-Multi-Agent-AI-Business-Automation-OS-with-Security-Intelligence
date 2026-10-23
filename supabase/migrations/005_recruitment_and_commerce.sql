-- ============================================================
--  Enterprise NeXus — Recruitment & Commerce Extension
--  Supabase Migration 005
--
--  Adds:
--    • roles: candidate, customer
--    • products, orders, product_reviews  (storefront)
--    • job_postings, job_applications      (careers)
--    • support_tickets: optional order/product link + source
--
--  Run via:  supabase db push
--         or paste into Supabase SQL Editor
--  (Run AFTER 001_initial_schema.sql — depends on users, roles, support_tickets)
-- ============================================================

-- ============================================================
--  ROLES — add external user classes
--  Uses WHERE NOT EXISTS instead of ON CONFLICT so this works
--  even if the live roles.name column has no unique constraint.
-- ============================================================
INSERT INTO roles (name, description)
SELECT 'candidate', 'External job applicant — access limited to careers portal and own applications'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'candidate');

INSERT INTO roles (name, description)
SELECT 'customer', 'External buyer — access limited to storefront and own orders/reviews'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'customer');

-- ============================================================
--  TABLE: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 2 AND 100),
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 200),
  tagline     TEXT        CHECK (char_length(tagline) <= 200),
  description TEXT,
  price       NUMERIC     NOT NULL CHECK (price > 0),
  icon        TEXT        NOT NULL DEFAULT 'inventory_2',
  highlights  JSONB       NOT NULL DEFAULT '[]',
  specs       JSONB       NOT NULL DEFAULT '[]',
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'draft', 'discontinued')),
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_slug   ON products(slug);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active products" ON products
  FOR SELECT USING (status = 'active');
CREATE POLICY "Staff manage products" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() AND r.name IN ('admin', 'manager'))
  );

-- ============================================================
--  TABLE: orders
--  Fully mocked checkout — no real payment gateway. status is
--  set to 'paid' immediately on creation; 'shipped'/'delivered'
--  are updated manually/by staff to demo the tracking view.
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total       NUMERIC     NOT NULL CHECK (total > 0),
  status      TEXT        NOT NULL DEFAULT 'paid'
                          CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id  ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at  ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers manage own orders" ON orders
  FOR ALL USING (customer_id = auth.uid());
CREATE POLICY "Staff read all orders" ON orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() AND r.name IN ('admin', 'manager'))
  );

-- ============================================================
--  TABLE: product_reviews
--  Second input channel into Support — sentiment/urgency are
--  filled by the same AI analysis already used for tickets.
-- ============================================================
CREATE TABLE IF NOT EXISTS product_reviews (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating              INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment             TEXT        NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 2000),
  sentiment           TEXT        CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  urgency             TEXT        CHECK (urgency IN ('low', 'medium', 'high')),
  flagged_as_complaint BOOLEAN    NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_flagged    ON product_reviews(flagged_as_complaint);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads reviews" ON product_reviews
  FOR SELECT USING (true);
CREATE POLICY "Customers write own reviews" ON product_reviews
  FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Customers update own reviews" ON product_reviews
  FOR UPDATE USING (customer_id = auth.uid());
CREATE POLICY "Customers delete own reviews" ON product_reviews
  FOR DELETE USING (customer_id = auth.uid());

-- ============================================================
--  TABLE: job_postings
-- ============================================================
CREATE TABLE IF NOT EXISTS job_postings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT        NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  department          TEXT        CHECK (char_length(department) <= 100),
  description         TEXT        NOT NULL,
  screening_criteria  TEXT        NOT NULL,
  required_skills     JSONB       NOT NULL DEFAULT '[]',
  -- required_skills shape: [{ "skill": "React", "weight": 30 }, ...] — weights should sum to 100
  status              TEXT        NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'open', 'closed')),
  posted_by           UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads open jobs" ON job_postings
  FOR SELECT USING (status = 'open');
CREATE POLICY "Staff manage job postings" ON job_postings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() AND r.name IN ('admin', 'manager', 'employee'))
  );

-- ============================================================
--  TABLE: job_applications
-- ============================================================
CREATE TABLE IF NOT EXISTS job_applications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID        NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  candidate_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cv_url            TEXT        NOT NULL,
  ai_score          INTEGER     CHECK (ai_score BETWEEN 0 AND 100),
  ai_confidence     TEXT        CHECK (ai_confidence IN ('low', 'medium', 'high')),
  ai_recommendation TEXT        CHECK (ai_recommendation IN ('shortlist', 'reject', 'review')),
  skill_scores      JSONB       NOT NULL DEFAULT '[]',
  -- skill_scores shape: [{ "skill": "React", "weight": 30, "score": 82 }, ...] — mirrors job_postings.required_skills
  narrative_summary TEXT,
  status            TEXT        NOT NULL DEFAULT 'applied'
                                CHECK (status IN ('applied', 'ai_screened', 'hr_confirmed', 'notified')),
  notified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_job_applications_job_id       ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_candidate_id ON job_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status       ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_ai_score     ON job_applications(ai_score DESC);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Candidates manage own applications" ON job_applications
  FOR ALL USING (candidate_id = auth.uid());
CREATE POLICY "Staff read all applications" ON job_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() AND r.name IN ('admin', 'manager', 'employee'))
  );

-- ============================================================
--  ALTER: support_tickets — optional order/product link
--  Nullable by design: general complaints without a specific
--  order remain valid (see SRS FR-8.4).
-- ============================================================
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS order_id   UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source     TEXT NOT NULL DEFAULT 'ticket_form'
                                      CHECK (source IN ('ticket_form', 'product_review'));

CREATE INDEX IF NOT EXISTS idx_support_tickets_order_id   ON support_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_product_id ON support_tickets(product_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_source     ON support_tickets(source);

-- ============================================================
--  SUMMARY
--  New tables (5): products, orders, product_reviews,
--                   job_postings, job_applications
--  New roles (2):   candidate, customer
--  Altered (1):     support_tickets (+order_id, +product_id, +source)
-- ============================================================
