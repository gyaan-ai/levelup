-- Allow linked parents (youth_wrestler_parents) to upload/update/delete youth wrestler photos,
-- not just the primary parent (parent_id). Fixes uploads failing for linked parents.

DROP POLICY IF EXISTS "Parents can upload youth wrestler photos" ON storage.objects;
CREATE POLICY "Parents can upload youth wrestler photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'athlete-photos' AND
  (storage.foldername(name))[1] = 'youth-wrestlers' AND
  (
    EXISTS (
      SELECT 1 FROM public.youth_wrestlers yw
      WHERE yw.id::text = (storage.foldername(name))[2]
      AND yw.parent_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.youth_wrestler_parents yp
      WHERE yp.youth_wrestler_id::text = (storage.foldername(name))[2]
      AND yp.parent_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Parents can update youth wrestler photos" ON storage.objects;
CREATE POLICY "Parents can update youth wrestler photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'athlete-photos' AND
  (storage.foldername(name))[1] = 'youth-wrestlers' AND
  (
    EXISTS (
      SELECT 1 FROM public.youth_wrestlers yw
      WHERE yw.id::text = (storage.foldername(name))[2]
      AND yw.parent_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.youth_wrestler_parents yp
      WHERE yp.youth_wrestler_id::text = (storage.foldername(name))[2]
      AND yp.parent_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Parents can delete youth wrestler photos" ON storage.objects;
CREATE POLICY "Parents can delete youth wrestler photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'athlete-photos' AND
  (storage.foldername(name))[1] = 'youth-wrestlers' AND
  (
    EXISTS (
      SELECT 1 FROM public.youth_wrestlers yw
      WHERE yw.id::text = (storage.foldername(name))[2]
      AND yw.parent_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.youth_wrestler_parents yp
      WHERE yp.youth_wrestler_id::text = (storage.foldername(name))[2]
      AND yp.parent_id = auth.uid()
    )
  )
);
