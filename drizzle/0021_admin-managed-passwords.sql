-- Serialize the credential-policy change with privileged account mutations.
SELECT pg_advisory_xact_lock(73190021);
--> statement-breakpoint
-- Record legacy first-login flags being retired; no password hashes are changed.
INSERT INTO public.audit_logs (organization_id, target_id, action, metadata)
SELECT DISTINCT assignments.organization_id, profiles.user_id,
  'employee.password-policy-updated',
  jsonb_build_object('before', jsonb_build_object('mustChangePassword', true),
    'after', jsonb_build_object('mustChangePassword', false),
    'reason', 'Admin-selected passwords permit direct sign-in')
FROM public.employee_profiles profiles
JOIN public.employee_role_assignments assignments ON assignments.user_id = profiles.user_id
WHERE profiles.must_change_password = true;
--> statement-breakpoint
UPDATE public.employee_profiles SET must_change_password = false WHERE must_change_password = true;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ALTER COLUMN "must_change_password" SET DEFAULT false;
