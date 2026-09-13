-- Account applications require an explicit admin approval before login.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Existing accounts predate this workflow and remain usable.
UPDATE public.users
SET approval_status = 'approved'
WHERE approval_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_approval_status_created_at
  ON public.users(approval_status, created_at DESC);
