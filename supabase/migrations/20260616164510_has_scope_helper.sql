-- ══════════════════════════════════════════════════════════════
-- Migration: has_scope() helper for RLS policies
-- ══════════════════════════════════════════════════════════════
-- Returns true if the calling auth user has the given scope in profiles.scopes,
-- OR if they are an admin (admins always pass scope checks).

CREATE FUNCTION public.has_scope(scope_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role = 'admin' OR scope_name = ANY(scopes))
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_scope(TEXT) TO authenticated;

-- True if the user holds at least one campaign:* scope (or is admin).
CREATE FUNCTION public.has_any_campaign_scope()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (
        role = 'admin'
        OR EXISTS (
          SELECT 1 FROM unnest(scopes) s WHERE s LIKE 'campaign:%'
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_any_campaign_scope() TO authenticated;
