-- ============================================================
-- 008_verify_email_otp.sql
-- Client-callable OTP verification. otp_codes has RLS with no client
-- policies, so verification must run through this SECURITY DEFINER RPC.
-- OTP *generation + send* happens in the send-email Edge Function
-- (service role + Resend key), never on the client.
--
-- Callable by anon too, because password-reset verification happens
-- while the user is logged OUT. The function only flips a row to used
-- and returns a boolean — it never returns OTP data.
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_email_otp(
  p_email   text,
  p_code    text,
  p_purpose text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_purpose NOT IN ('signup','reset') THEN
    RAISE EXCEPTION 'invalid otp purpose';
  END IF;

  SELECT id INTO v_id
  FROM otp_codes
  WHERE lower(email) = lower(p_email)
    AND code = p_code
    AND purpose = p_purpose
    AND used = false
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE otp_codes SET used = true WHERE id = v_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_email_otp(text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_email_otp(text,text,text) TO anon, authenticated;
