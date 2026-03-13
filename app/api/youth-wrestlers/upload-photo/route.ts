import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const isAdmin = userData?.role === 'admin';

    if (!isAdmin) {
      const { data: existing } = await supabase
        .from('youth_wrestlers')
        .select('parent_id')
        .eq('id', youthWrestlerId)
        .single();
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (existing.parent_id !== user.id) {
        const { data: link } = await supabase.from('youth_wrestler_parents').select('id').eq('youth_wrestler_id', youthWrestlerId).eq('parent_id', user.id).maybeSingle();
        if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    const db = isAdmin ? createAdminClient(tenant.slug) : supabase;

    // Upload photo (reuse athlete photo storage, but with youth wrestler ID)
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `youth-wrestlers/${youthWrestlerId}/${fileName}`;

    // Delete old photo if exists
    const { data: oldData } = await db
      .from('youth_wrestlers')
      .select('photo_url')
      .eq('id', youthWrestlerId)
      .single();

    if (oldData?.photo_url) {
      const oldUrl = oldData.photo_url;
      const oldPathMatch = oldUrl.match(/\/storage\/v1\/object\/public\/athlete-photos\/(.+)/);
      if (oldPathMatch) {
        await db.storage
          .from('athlete-photos')
          .remove([oldPathMatch[1]]);
      }
    }

    const { data, error: uploadError } = await db.storage
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
    const { data: urlData } = db.storage
      .from('athlete-photos')
      .getPublicUrl(data.path);

    // Persist to DB immediately so the photo shows even if form save fails or is skipped
    const { error: updateError } = await db
      .from('youth_wrestlers')
      .update({ photo_url: urlData.publicUrl })
      .eq('id', youthWrestlerId);

    if (updateError) {
      console.error('Failed to save photo_url to youth_wrestlers:', updateError);
      // Still return the URL so the client can retry update with it
    }

    return NextResponse.json({ photoUrl: urlData.publicUrl });
  } catch (error: any) {
    console.error('Error uploading photo:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

