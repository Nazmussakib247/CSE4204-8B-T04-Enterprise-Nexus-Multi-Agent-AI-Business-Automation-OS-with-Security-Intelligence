-- Candidates can register and apply immediately; only office roles need approval.
UPDATE public.users AS u
SET is_active = true,
    approval_status = 'approved',
    approved_at = COALESCE(approved_at, NOW())
FROM public.roles AS r
WHERE u.role_id = r.id
  AND r.name = 'candidate'
  AND (u.approval_status = 'pending' OR u.is_active = false);
