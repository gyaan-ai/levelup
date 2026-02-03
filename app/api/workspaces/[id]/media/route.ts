import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

// POST /api/workspaces/[id]/media - Upload video/image
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient(tenant.slug);
    const { data: ws } = await admin.from('workspaces').select('parent_id, athlete_id').eq('id', workspaceId).single();
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    const { data: ud } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (ws.parent_id !== user.id && ws.athlete_id !== user.id && ud?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const description = (formData.get('description') as string) || '';

    if (!file || !file.size) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isVideo = ['mp4', 'mov', 'webm', 'm4v'].includes(ext);
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext);
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: 'Only video (mp4, mov, webm) and image (jpg, png, webp, heic) files allowed' }, { status: 400 });
    }

    // Map extension to allowed MIME type (bucket restricts by MIME)
    const mimeMap: Record<string, string> = {
      mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
      heic: 'image/heic', heif: 'image/heif',
    };
    const contentType = mimeMap[ext] || (isVideo ? 'video/mp4' : 'image/jpeg');

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 50MB' }, { status: 400 });
    }

    const storagePath = `${workspaceId}/${crypto.randomUUID()}.${ext}`;

    // Convert to Buffer for reliable upload in serverless (FormData File can be incomplete)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await admin.storage
      .from('workspace-media')
      .upload(storagePath, buffer, { cacheControl: '3600', upsert: false, contentType });

    if (uploadError) {
      console.error('Workspace media upload error:', uploadError);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: signedUrl } = await admin.storage
      .from('workspace-media')
      .createSignedUrl(uploadData.path, 60 * 60 * 24 * 7);

    const { data: media, error } = await admin
      .from('workspace_media')
      .insert({
        workspace_id: workspaceId,
        storage_path: uploadData.path,
        url: signedUrl?.signedUrl || null,
        file_name: file.name,
        media_type: isVideo ? 'video' : 'image',
        description: description.trim() || null,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ media });
  } catch (e) {
    console.error('Media upload error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
