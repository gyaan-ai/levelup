import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

async function requireAdmin(tenantSlug: string) {
  const supabase = await createClient(tenantSlug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: athleteId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const authError = await requireAdmin(tenant.slug);
    if (authError) return authError;

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });

    const admin = createAdminClient(tenant.slug);

    const { data: existing } = await admin.from('athletes').select('id, photo_url').eq('id', athleteId).single();
    if (!existing) return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });

    if (existing.photo_url) {
      const oldPathMatch = existing.photo_url.match(/\/storage\/v1\/object\/public\/athlete-photos\/(.+)/);
      if (oldPathMatch) {
        await admin.storage.from('athlete-photos').remove([oldPathMatch[1]]);
      }
    }

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${athleteId}/${fileName}`;

    const { data: uploadData, error: uploadError } = await admin.storage
      .from('athlete-photos')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error('Admin upload photo error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from('athlete-photos').getPublicUrl(uploadData.path);
    const { error: updateError } = await admin
      .from('athletes')
      .update({ photo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
      .eq('id', athleteId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ photoUrl: urlData.publicUrl });
  } catch (e) {
    console.error('Admin upload athlete photo error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
