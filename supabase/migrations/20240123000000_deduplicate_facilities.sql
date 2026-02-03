-- Deduplicate facilities: keep one per school (prefer "Facility" over "Room")
-- Merges "UNC Wrestling Room" + "UNC Wrestling Facility" -> keep Facility
-- Merges "NC State Wrestling Room" + "NC State Wrestling Facility" -> keep Facility

DO $$
DECLARE
  r RECORD;
  keeper_id UUID;
  dup_id UUID;
BEGIN
  FOR r IN (
    SELECT school, array_agg(id ORDER BY CASE WHEN name LIKE '%Facility%' THEN 0 ELSE 1 END, name) AS ids
    FROM public.facilities
    GROUP BY school
    HAVING COUNT(*) > 1
  )
  LOOP
    keeper_id := r.ids[1];
    FOR i IN 2..array_length(r.ids, 1) LOOP
      dup_id := r.ids[i];
      UPDATE public.athletes SET facility_id = keeper_id WHERE facility_id = dup_id;
      UPDATE public.sessions SET facility_id = keeper_id WHERE facility_id = dup_id;
      UPDATE public.blocked_times SET facility_id = keeper_id WHERE facility_id = dup_id;
      DELETE FROM public.facilities WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

-- Prevent future dupes: unique on (school, name)
ALTER TABLE public.facilities ADD CONSTRAINT facilities_school_name_unique UNIQUE (school, name);
