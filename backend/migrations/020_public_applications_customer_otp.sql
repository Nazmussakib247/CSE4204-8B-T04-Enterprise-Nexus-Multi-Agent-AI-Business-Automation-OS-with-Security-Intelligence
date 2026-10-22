ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS applicant_name TEXT;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS applicant_email TEXT;
ALTER TABLE job_applications ALTER COLUMN candidate_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_email ON job_applications (lower(applicant_email));
ALTER TABLE email_verification_codes DROP CONSTRAINT IF EXISTS email_verification_codes_purpose_check;
ALTER TABLE email_verification_codes ADD CONSTRAINT email_verification_codes_purpose_check CHECK (purpose IN ('office_registration', 'customer_registration'));
