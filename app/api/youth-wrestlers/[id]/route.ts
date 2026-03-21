import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { validateRequiredYouthPhone } from '@/lib/phone';

// GET - Get single youth wrestler (parent, linked parent, or admin)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const isAdmin = userData?.role === 'admin';

    const db = isAdmin ? createAdminClient(tenant.slug) : supabase;

    const { data: youthWrestler, error } = await db
      .from('youth_wrestlers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !youthWrestler) {
      if (error?.code === 'PGRST116' || !youthWrestler) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ error: error?.message ?? 'Internal server error' }, { status: 500 });
    }

    // Get sessions for this youth wrestler
    const { data: sessions } = await db
      .from('sessions')
      .select('*, athletes(first_name, last_name), facilities(name)')
      .eq('youth_wrestler_id', id)
      .order('scheduled_datetime', { ascending: false });

    return NextResponse.json({
      youthWrestler,
      sessions: sessions || [],
    });
  } catch (error) {
    console.error('Error fetching youth wrestler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update youth wrestler
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const isAdmin = userData?.role === 'admin';

    if (!isAdmin) {
      const { data: existing } = await supabase.from('youth_wrestlers').select('parent_id').eq('id', id).single();
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (existing.parent_id !== user.id) {
        const { data: link } = await supabase.from('youth_wrestler_parents').select('id').eq('youth_wrestler_id', id).eq('parent_id', user.id).maybeSingle();
        if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const db = isAdmin ? createAdminClient(tenant.slug) : supabase;
    const body = await req.json();
    const {
      firstName,
      lastName,
      dateOfBirth,
      school,
      graduationYear,
      weightClass,
      skillLevel,
      wrestlingExperience,
      goals,
      medicalNotes,
      photoUrl,
      photoFocusX,
      photoFocusY,
      phone,
    } = body;

    const phoneCheck = validateRequiredYouthPhone(phone);
    if (!phoneCheck.ok) {
      return NextResponse.json({ error: phoneCheck.message }, { status: 400 });
    }

    const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
    const focusX = photoFocusX != null ? clamp(Number(photoFocusX)) : undefined;
    const focusY = photoFocusY != null ? clamp(Number(photoFocusY)) : undefined;

    // Calculate age from date of birth
    let age: number | null = null;
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    const updatePayload: Record<string, unknown> = {
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth || null,
      age: age,
      school: school || null,
      graduation_year: graduationYear ?? null,
      weight_class: weightClass || null,
      skill_level: skillLevel || null,
      wrestling_experience: wrestlingExperience || null,
      goals: goals || null,
      medical_notes: medicalNotes || null,
      photo_url: photoUrl || null,
      phone: phoneCheck.phone,
    };
    if (focusX !== undefined) updatePayload.photo_focus_x = focusX;
    if (focusY !== undefined) updatePayload.photo_focus_y = focusY;

    const { data: youthWrestler, error } = await db
      .from('youth_wrestlers')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ youthWrestler });
  } catch (error) {
    console.error('Error updating youth wrestler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete youth wrestler
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const isAdmin = userData?.role === 'admin';

    if (!isAdmin) {
      const { data: existing } = await supabase
        .from('youth_wrestlers')
        .select('parent_id')
        .eq('id', id)
        .single();
      if (!existing || existing.parent_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const db = isAdmin ? createAdminClient(tenant.slug) : supabase;
    const { error } = await db
      .from('youth_wrestlers')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting youth wrestler:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

