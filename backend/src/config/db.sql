-- =====================================================
-- 1. CREATE THE DATABASE
--    Change 'management_db' to your preferred name.
-- =====================================================
CREATE DATABASE enterprise_nexus
WITH ENCODING 'UTF8'
OWNER = postgres;  -- Change 'postgres' to your DB user if needed

-- =====================================================
-- 2. CONNECT TO THE NEW DATABASE
--    (Works when running with psql -f)
-- =====================================================
\c enterprise_nexus

-- =====================================================
-- 3. ENABLE UUID GENERATION EXTENSION
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 4. CREATE TABLES
-- =====================================================

-- 4.1 ROLES
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.2 USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.3 FINANCE_RECORDS
CREATE TABLE finance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    expense_date DATE NOT NULL,
    description TEXT,
    severity VARCHAR(50),
    ai_analysis TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.4 TASKS (Note: "load" column uses JSONB, matching the diagram's 'jsbrises load')
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_type VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    load JSONB,                     -- Diagram had 'jsbrises load'
    result TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 4.5 ANALYTICS_REPORTS
CREATE TABLE analytics_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    performance_rating VARCHAR(50),
    overall_score INTEGER,
    ai_insights TEXT,
    action_items JSONB,
    kpi_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.6 HR_REPORTS
CREATE TABLE hr_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    candidate_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    ai_score INTEGER,
    confidence FLOAT,
    recommendation VARCHAR(255),
    narrative_summary TEXT,
    score_breakdown JSONB,
    extracted_profile JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.7 SUPPORT_TICKETS
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    ai_response TEXT,
    intent VARCHAR(255),
    urgency VARCHAR(50),
    sentiment VARCHAR(50),
    confidence FLOAT,
    escalated BOOLEAN DEFAULT FALSE,
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.8 EXECUTIVE_REPORTS
CREATE TABLE executive_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    performance_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. ADD PERFORMANCE INDEXES (Foreign Keys + common filters)
-- =====================================================
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_finance_user_id ON finance_records(user_id);
CREATE INDEX idx_finance_expense_date ON finance_records(expense_date);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_analytics_user_id ON analytics_reports(user_id);
CREATE INDEX idx_hr_user_id ON hr_reports(user_id);
CREATE INDEX idx_support_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_task_id ON support_tickets(task_id);
CREATE INDEX idx_support_status ON support_tickets(status);
CREATE INDEX idx_executive_user_id ON executive_reports(user_id);

-- =====================================================
-- 6. AUTO-UPDATE 'updated_at' FOR USERS TABLE
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. (OPTIONAL) SEED DEFAULT ROLES
--    Uncomment below to insert initial roles.
-- =====================================================
-- INSERT INTO roles (name, description) VALUES
-- ('admin', 'System administrator with full access'),
-- ('manager', 'Manager with oversight privileges'),
-- ('employee', 'Regular employee with basic access');
-- 
-- INSERT INTO users (role_id, name, email, password_hash) 
-- SELECT id, 'Admin User', 'admin@example.com', 'hash_me' FROM roles WHERE name = 'admin';

-- =====================================================
-- 8. VERIFICATION (Optional - run to see tables)
-- =====================================================
\dt