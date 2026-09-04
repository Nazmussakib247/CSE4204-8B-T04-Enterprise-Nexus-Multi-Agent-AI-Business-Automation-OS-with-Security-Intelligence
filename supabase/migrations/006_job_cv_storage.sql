-- Private CV storage used by the job application upload endpoint.
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-cvs', 'job-cvs', false)
ON CONFLICT (id) DO NOTHING;
