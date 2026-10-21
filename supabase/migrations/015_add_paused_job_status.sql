-- Paused jobs remain available to HR but are excluded from public careers and applications.
ALTER TABLE public.job_postings
  DROP CONSTRAINT IF EXISTS job_postings_status_check;

ALTER TABLE public.job_postings
  ADD CONSTRAINT job_postings_status_check
  CHECK (status IN ('draft', 'open', 'paused', 'closed'));
