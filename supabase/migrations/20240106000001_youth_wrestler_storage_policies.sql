-- Storage policies for youth wrestler photos
-- Allow parents to upload photos for their youth wrestlers

-- Policy: Parents can upload photos for their youth wrestlers
CREATE POLICY "Parents can upload youth wrestler photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'athlete-photos' AND
  (storage.foldername(name))[1] = 'youth-wrestlers' AND
  EXISTS (
    SELECT 1 FROM public.youth_wrestlers
    WHERE id::text = (storage.foldername(name))[2]
    AND parent_id = auth.uid()
  )
);

-- Policy: Parents can update photos for their youth wrestlers
CREATE POLICY "Parents can update youth wrestler photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'athlete-photos' AND
  (storage.foldername(name))[1] = 'youth-wrestlers' AND
  EXISTS (
    SELECT 1 FROM public.youth_wrestlers
    WHERE id::text = (storage.foldername(name))[2]
    AND parent_id = auth.uid()
  )
);

-- Policy: Parents can delete photos for their youth wrestlers
CREATE POLICY "Parents can delete youth wrestler photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'athlete-photos' AND
  (storage.foldername(name))[1] = 'youth-wrestlers' AND
  EXISTS (
    SELECT 1 FROM public.youth_wrestlers
    WHERE id::text = (storage.foldername(name))[2]
    AND parent_id = auth.uid()
  )
);

-- Public read access is already covered by the existing "Public read access for athlete photos" policy





