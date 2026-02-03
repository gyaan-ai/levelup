-- Add mobile MIME types for workspace-media bucket (HEIC, M4V, etc.)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/pjpeg'
]
WHERE id = 'workspace-media';
