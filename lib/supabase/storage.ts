import { createClient } from './client';
import { getTenantConfig } from '@/config/tenants';

export async function uploadAthletePhoto(
  tenantSlug: string,
  athleteId: string,
  file: File
): Promise<string> {
  const supabase = createClient(tenantSlug);

  // Create file path: {athleteId}/{timestamp}-{filename}
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${athleteId}/${fileName}`;

  // Upload file
  const { data, error } = await supabase.storage
    .from('athlete-photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload photo: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('athlete-photos')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export async function deleteAthletePhoto(
  tenantSlug: string,
  photoUrl: string
): Promise<void> {
  const supabase = createClient(tenantSlug);

  // Extract path from URL
  const urlParts = photoUrl.split('/');
  const pathIndex = urlParts.findIndex(part => part === 'athlete-photos');
  if (pathIndex === -1) {
    throw new Error('Invalid photo URL');
  }

  const filePath = urlParts.slice(pathIndex).join('/');

  const { error } = await supabase.storage
    .from('athlete-photos')
    .remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete photo: ${error.message}`);
  }
}

