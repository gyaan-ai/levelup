import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

// GET - Get single youth wrestler
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

    const { data: youthWrestler, error } = await supabase
      .from('youth_wrestlers')
      .select('*')
      .eq('id', id)
      .eq('parent_id', user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!youthWrestler) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Get sessions for this youth wrestler
    const { data: sessions } = await supabase
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

    // Verify ownership
    const { data: existing } = await supabase
      .from('youth_wrestlers')
      .select('parent_id')
      .eq('id', id)
      .single();

    if (!existing || existing.parent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      dateOfBirth,
      school,
      grade,
      weightClass,
      skillLevel,
      wrestlingExperience,
      goals,
      medicalNotes,
      photoUrl,
    } = body;

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

    const { data: youthWrestler, error } = await supabase
      .from('youth_wrestlers')
      .update({
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth || null,
        age: age,
        school: school || null,
        grade: grade || null,
        weight_class: weightClass || null,
        skill_level: skillLevel || null,
        wrestling_experience: wrestlingExperience || null,
        goals: goals || null,
        medical_notes: medicalNotes || null,
        photo_url: photoUrl || null,
      })
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

    // Verify ownership
    const { data: existing } = await supabase
      .from('youth_wrestlers')
      .select('parent_id')
      .eq('id', id)
      .single();

    if (!existing || existing.parent_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
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

