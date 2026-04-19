-- =============================================================================
-- LevelUp app profile + kids (ONLY if public.users exists on this database)
-- =============================================================================
-- If you get "relation public.users does not exist", do NOT use this file.
-- Fix: open the Supabase project that actually runs LevelUp, or run migrations.
--
-- Replace email once, then run.
-- =============================================================================

WITH u AS (
  SELECT id, email, role, first_name, last_name, created_at, archived_at, last_login_at
  FROM public.users
  WHERE lower(email) = lower('REPLACE_WITH_EMAIL')
)
SELECT 'profile' AS kind,
       u.id::text AS id,
       u.email,
       u.role::text AS detail,
       trim(concat_ws(' ', u.first_name, u.last_name)) AS name,
       u.created_at,
       u.archived_at,
       u.last_login_at
FROM u
UNION ALL
SELECT 'kid_primary',
       y.id::text,
       u.email,
       'primary parent for'::text,
       trim(concat_ws(' ', y.first_name, y.last_name)),
       y.created_at,
       null::timestamptz,
       null::timestamptz
FROM u
JOIN public.youth_wrestlers y ON y.parent_id = u.id AND y.active = true
UNION ALL
SELECT 'kid_linked',
       y.id::text,
       u.email,
       'linked parent for'::text,
       trim(concat_ws(' ', y.first_name, y.last_name)),
       y.created_at,
       null::timestamptz,
       null::timestamptz
FROM u
JOIN public.youth_wrestler_parents yp ON yp.parent_id = u.id
JOIN public.youth_wrestlers y ON y.id = yp.youth_wrestler_id AND y.active = true
ORDER BY kind, name;
