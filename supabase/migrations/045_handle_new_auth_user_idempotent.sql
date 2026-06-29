-- Make the new-user → vendor-profile trigger idempotent and email-safe so a
-- returning user is never pushed back through profile creation. If a profile
-- already exists for this id (trigger re-fire) OR this email (e.g. someone who
-- registered with a password and is now linking Google to the same email), do
-- nothing — the existing profile and its onboarding state are preserved.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO vendors (id, email)
  VALUES (NEW.id, LOWER(NEW.email))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;
