-- Ensure Appalachian State wrestling facility exists (geocoded for coach map pins) and
-- align coach Colt Campbell to it (primary facility + coach_facilities).

-- Avoid ON CONFLICT (school, name): some DBs never got facilities_school_name_unique.
INSERT INTO public.facilities (name, school, address, latitude, longitude)
SELECT
  'Appalachian State Wrestling Facility',
  'Appalachian State',
  '261 Jack Branch Dr, Boone, NC 28607',
  36.2139,
  -81.6774
WHERE NOT EXISTS (
  SELECT 1
  FROM public.facilities AS existing
  WHERE existing.school = 'Appalachian State'
    AND existing.name = 'Appalachian State Wrestling Facility'
);

UPDATE public.facilities
SET
  address = COALESCE(address, '261 Jack Branch Dr, Boone, NC 28607'),
  latitude = COALESCE(latitude, 36.2139),
  longitude = COALESCE(longitude, -81.6774),
  updated_at = NOW()
WHERE school = 'Appalachian State'
  AND name = 'Appalachian State Wrestling Facility';

-- Sync primary facility; clear secondary so listing/map reflect one home base unless ops adds another later.
UPDATE public.athletes AS a
SET
  facility_id = f.id,
  secondary_facility_id = NULL,
  updated_at = NOW()
FROM public.facilities AS f
WHERE f.school = 'Appalachian State'
  AND f.name = 'Appalachian State Wrestling Facility'
  AND lower(trim(a.first_name)) = 'colt'
  AND lower(trim(a.last_name)) = 'campbell';

-- Match training filters / discovery: mirror athletes.facility_id in coach_facilities.
DELETE FROM public.coach_facilities AS cf
USING public.athletes AS a
WHERE cf.coach_id = a.id
  AND lower(trim(a.first_name)) = 'colt'
  AND lower(trim(a.last_name)) = 'campbell';

INSERT INTO public.coach_facilities (coach_id, facility_id)
SELECT a.id, f.id
FROM public.athletes AS a
CROSS JOIN public.facilities AS f
WHERE f.school = 'Appalachian State'
  AND f.name = 'Appalachian State Wrestling Facility'
  AND lower(trim(a.first_name)) = 'colt'
  AND lower(trim(a.last_name)) = 'campbell';
