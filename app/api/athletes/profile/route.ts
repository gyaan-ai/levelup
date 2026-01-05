import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

export async function GET(req: NextRequest) {
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

    // Get athlete profile
    const { data: athlete, error } = await supabase
      .from('athletes')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get facilities for dropdown
    const { data: facilities } = await supabase
      .from('facilities')
      .select('*')
      .order('name');

    return NextResponse.json({
      athlete: athlete || null,
      facilities: facilities || [],
    });
  } catch (error) {
    console.error('Error fetching athlete profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
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

    const body = await req.json();
    const { weightClass, bio, credentials, photoUrl, facilityId } = body;

    // Check if user is an athlete
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'athlete') {
      return NextResponse.json({ error: 'User is not an athlete' }, { status: 400 });
    }

    // Use admin client to bypass RLS for this operation
    // We've already verified the user is authenticated and is an athlete
    const supabaseAdmin = createAdminClient(tenant.slug);

    // Get existing athlete data to preserve first_name, last_name, school
    const { data: existing } = await supabaseAdmin
      .from('athletes')
      .select('first_name, last_name, school')
      .eq('id', user.id)
      .maybeSingle();

    const updateData: any = {
      weight_class: weightClass || null,
      bio: bio || null,
      credentials: credentials || {},
      photo_url: photoUrl || null,
      facility_id: facilityId || null,
    };

    // Check if record exists
    if (existing) {
      // Record exists - use UPDATE
      const { error: updateError } = await supabaseAdmin
        .from('athletes')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      // Record doesn't exist - use INSERT (shouldn't happen, but handle it)
      // Get user info to populate required fields
      const { data: userInfo } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', user.id)
        .single();

      const { error: insertError } = await supabaseAdmin
        .from('athletes')
        .insert({
          id: user.id,
          first_name: 'Athlete', // Fallback - should be set during signup
          last_name: 'User', // Fallback - should be set during signup
          school: '', // Fallback - should be set during signup
          ...updateData,
        });

      if (insertError) {
        // If insert fails with duplicate key, try update instead (race condition)
        if (insertError.message?.includes('duplicate key') || insertError.code === '23505') {
          const { error: updateError } = await supabaseAdmin
            .from('athletes')
            .update(updateData)
            .eq('id', user.id);

          if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
          }
        } else {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating athlete profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

