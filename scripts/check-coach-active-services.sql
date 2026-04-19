-- Optional admin check: active athlete_services rows per coach (private / partner / small_group).
-- Replace names or add ILIKE patterns for your roster (e.g. Liam, Cam, Sabino).

SELECT
  a.id AS athlete_id,
  a.first_name,
  a.last_name,
  a.school,
  array_agg(DISTINCT s.session_type ORDER BY s.session_type) FILTER (WHERE s.id IS NOT NULL) AS active_service_types,
  COUNT(DISTINCT s.id) AS service_row_count
FROM public.athletes a
LEFT JOIN public.athlete_services s
  ON s.athlete_id = a.id AND s.active = true
WHERE a.active = true
  AND (
    a.last_name ILIKE '%Hickey%'
    OR a.first_name ILIKE '%Liam%'
    OR a.first_name ILIKE '%Cam%'
    OR a.first_name ILIKE '%Sabino%'
  )
GROUP BY a.id, a.first_name, a.last_name, a.school
ORDER BY a.last_name, a.first_name;

-- Enabled athlete_products (fallback for Training filters when services are missing)
SELECT
  a.id AS athlete_id,
  a.first_name,
  a.last_name,
  p.slug AS product_slug
FROM public.athletes a
JOIN public.athlete_products ap ON ap.athlete_id = a.id AND ap.enabled = true
JOIN public.products p ON p.id = ap.product_id AND p.active = true
WHERE a.active = true
  AND (
    a.last_name ILIKE '%Hickey%'
    OR a.first_name ILIKE '%Liam%'
    OR a.first_name ILIKE '%Cam%'
    OR a.first_name ILIKE '%Sabino%'
  )
ORDER BY a.last_name, a.first_name, p.slug;
