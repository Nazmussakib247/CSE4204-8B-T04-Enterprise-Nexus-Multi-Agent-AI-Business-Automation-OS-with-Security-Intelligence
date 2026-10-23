-- Compatibility migration for projects where the initial schema was applied
-- before the public careers/customer-account changes.

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS applicant_name TEXT,
  ADD COLUMN IF NOT EXISTS applicant_email TEXT;

ALTER TABLE public.job_applications
  ALTER COLUMN candidate_id DROP NOT NULL;

UPDATE public.job_applications application
SET applicant_name = COALESCE(application.applicant_name, account.name),
    applicant_email = COALESCE(application.applicant_email, account.email)
FROM public.users account
WHERE account.id = application.candidate_id
  AND (application.applicant_name IS NULL OR application.applicant_email IS NULL);

ALTER TABLE public.finance_records
  ADD COLUMN IF NOT EXISTS is_anomaly BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_analysis TEXT;

ALTER TABLE public.executive_reports
  ADD COLUMN IF NOT EXISTS ai_briefing TEXT,
  ADD COLUMN IF NOT EXISTS briefing_data JSONB,
  ADD COLUMN IF NOT EXISTS period_type TEXT,
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end DATE,
  ADD COLUMN IF NOT EXISTS recommendations JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.email_verification_codes
  DROP CONSTRAINT IF EXISTS email_verification_codes_purpose_check;
ALTER TABLE public.email_verification_codes
  ADD CONSTRAINT email_verification_codes_purpose_check
  CHECK (purpose IN ('office_registration', 'customer_registration'));
