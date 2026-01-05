import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
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

    // Check if athlete profile exists
    const { data: existing } = await supabase
      .from('athletes')
      .select('id')
      .eq('id', user.id)
      .single();

    const updateData: any = {
      weight_class: weightClass || null,
      bio: bio || null,
      credentials: credentials || {},
      photo_url: photoUrl || null,
      facility_id: facilityId || null,
    };

    if (existing) {
      // Update existing profile
      const { error } = await supabase
        .from('athletes')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Create new profile (shouldn't happen, but handle it)
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!userData || userData.role !== 'athlete') {
        return NextResponse.json({ error: 'User is not an athlete' }, { status: 400 });
      }

      // Get athlete's basic info from signup
      const { data: athleteData } = await supabase
        .from('athletes')
        .select('first_name, last_name, school')
        .eq('id', user.id)
        .single();

      const { error } = await supabase
        .from('athletes')
        .insert({
          id: user.id,
          first_name: athleteData?.first_name || '',
          last_name: athleteData?.last_name || '',
          school: athleteData?.school || '',
          ...updateData,
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
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

