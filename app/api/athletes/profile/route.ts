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

    // Use admin client to bypass RLS completely
    // We've already verified the user is authenticated and is an athlete
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient(tenant.slug);
    } catch (error: any) {
      console.error('Failed to create admin client:', error);
      return NextResponse.json({ 
        error: 'Server configuration error. Please contact support.' 
      }, { status: 500 });
    }

    // Get existing athlete data to preserve first_name, last_name, school
    // This MUST work with admin client (bypasses RLS)
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('athletes')
      .select('first_name, last_name, school')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing athlete:', fetchError);
      return NextResponse.json({ 
        error: `Failed to fetch profile: ${fetchError.message}` 
      }, { status: 500 });
    }

    const updateData: any = {
      weight_class: weightClass || null,
      bio: bio || null,
      credentials: credentials || {},
      photo_url: photoUrl || null,
      facility_id: facilityId || null,
    };

    // ALWAYS try UPDATE first (record should exist from signup)
    // Admin client bypasses RLS, so this should work
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from('athletes')
      .update(updateData)
      .eq('id', user.id)
      .select('id');

    // If UPDATE succeeded (affected at least 1 row), verify and return
    if (updateResult && updateResult.length > 0) {
      console.log('Profile updated successfully for user:', user.id);
      
      // Verify the update by fetching the record
      const { data: verified } = await supabaseAdmin
        .from('athletes')
        .select('bio, photo_url, weight_class')
        .eq('id', user.id)
        .single();
      
      console.log('Verified profile data:', verified);
      
      return NextResponse.json({ 
        success: true, 
        updated: true,
        athlete: verified 
      });
    }

    // Log if update returned 0 rows
    if (!updateError && (!updateResult || updateResult.length === 0)) {
      console.warn('UPDATE returned 0 rows for user:', user.id, 'Attempting INSERT...');
    }

    // If UPDATE affected 0 rows, record doesn't exist - try INSERT
    // This shouldn't happen if signup worked, but handle it
    if (updateError) {
      console.error('Update error:', updateError);
      // If update failed for a reason other than "not found", return error
      if (!updateError.message?.includes('0 rows') && updateError.code !== 'PGRST116') {
        return NextResponse.json({ 
          error: `Update failed: ${updateError.message}` 
        }, { status: 500 });
      }
    }

    // Record doesn't exist - INSERT it
    // Get required fields from signup data if available
    const { data: signupData } = await supabaseAdmin
      .from('athletes')
      .select('first_name, last_name, school')
      .eq('id', user.id)
      .maybeSingle();

    const insertData = {
      id: user.id,
      first_name: signupData?.first_name || existing?.first_name || 'Athlete',
      last_name: signupData?.last_name || existing?.last_name || 'User',
      school: signupData?.school || existing?.school || '',
      ...updateData,
    };

    const { error: insertError } = await supabaseAdmin
      .from('athletes')
      .insert(insertData);

    if (insertError) {
      // If duplicate key error, record was created between check and insert
      // Try UPDATE one more time
      if (insertError.message?.includes('duplicate key') || insertError.code === '23505') {
        const { error: retryUpdateError } = await supabaseAdmin
          .from('athletes')
          .update(updateData)
          .eq('id', user.id);

        if (retryUpdateError) {
          console.error('Retry update error:', retryUpdateError);
          return NextResponse.json({ 
            error: `Failed to save profile: ${retryUpdateError.message}` 
          }, { status: 500 });
        }
        // Success on retry
        return NextResponse.json({ success: true });
      } else {
        console.error('Insert error:', insertError);
        return NextResponse.json({ 
          error: `Failed to create profile: ${insertError.message}` 
        }, { status: 500 });
      }
    }

    // INSERT succeeded
    return NextResponse.json({ success: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating athlete profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

