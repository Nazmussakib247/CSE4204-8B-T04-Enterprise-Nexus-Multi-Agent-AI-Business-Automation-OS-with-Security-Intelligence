-- Office-role hardening: only admins may read the organisation-wide audit log.
-- Backend requests use the service role, but this protects direct Supabase use too.

DROP POLICY IF EXISTS "Admins and managers read audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins read audit logs" ON audit_logs;

CREATE POLICY "Admins read audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

-- Application actors must not be able to alter or erase the record trail.
-- Audit writes are performed only through the backend service-role client.
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_created_at
  ON audit_logs(resource_type, created_at DESC);
