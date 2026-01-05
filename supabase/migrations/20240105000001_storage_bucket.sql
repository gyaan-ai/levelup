-- Create storage bucket for athlete photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('athlete-photos', 'athlete-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for athlete-photos bucket
-- Allow authenticated users to upload their own photos
CREATE POLICY "Athletes can upload own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'athlete-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access
CREATE POLICY "Public read access for athlete photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'athlete-photos');

-- Allow athletes to update their own photos
CREATE POLICY "Athletes can update own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'athlete-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow athletes to delete their own photos
CREATE POLICY "Athletes can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'athlete-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

