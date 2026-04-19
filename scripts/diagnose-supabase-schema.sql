-- =============================================================================
-- Which Supabase project is THIS? (runs on any Postgres — no LevelUp tables required)
-- =============================================================================
-- If you don't see: users, reviews, youth_wrestlers, athletes, sessions
-- then this is NOT the database your LevelUp app uses. Open a different project
-- in the Supabase dashboard (match URL to NEXT_PUBLIC_SUPABASE_URL / tenant config).
-- =============================================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Missing LevelUp tables (if any rows return, this DB is not the full app schema)
SELECT missing.expected AS missing_table
FROM (
  SELECT unnest(ARRAY[
    'users', 'reviews', 'athletes', 'sessions', 'youth_wrestlers'
  ]) AS expected
) AS missing
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name = missing.expected
);
