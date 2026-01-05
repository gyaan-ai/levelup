import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const youthWrestlerId = formData.get('youthWrestlerId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!youthWrestlerId) {
      return NextResponse.json({ error: 'Youth wrestler ID required' }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('youth_wrestlers')
      .select('parent_id')
      .eq('id', youthWrestlerId)
      .single();

    if (!existing || existing.parent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    // Upload photo (reuse athlete photo storage, but with youth wrestler ID)
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `youth-wrestlers/${youthWrestlerId}/${fileName}`;

    // Delete old photo if exists
    const { data: oldData } = await supabase
      .from('youth_wrestlers')
      .select('photo_url')
      .eq('id', youthWrestlerId)
      .single();

    if (oldData?.photo_url) {
      // Extract path from URL
      const oldUrl = oldData.photo_url;
      const oldPathMatch = oldUrl.match(/\/storage\/v1\/object\/public\/athlete-photos\/(.+)/);
      if (oldPathMatch) {
        await supabase.storage
          .from('athlete-photos')
          .remove([oldPathMatch[1]]);
      }
    }

    const { data, error: uploadError } = await supabase.storage
      .from('athlete-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: `Failed to upload photo: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('athlete-photos')
      .getPublicUrl(data.path);

    return NextResponse.json({ photoUrl: urlData.publicUrl });
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

