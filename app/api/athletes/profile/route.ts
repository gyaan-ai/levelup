import { NextRequest, NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { normalizeZelleInput } from '@/lib/zelle';

async function resolveProfileAthleteId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authUserId: string
): Promise<
  | { ok: true; athleteUserId: string; useAdminRead: boolean }
  | { ok: false; status: number; error: string }
> {
  const { data: userData, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUserId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  if (userData?.role === 'coach') {
    return { ok: true, athleteUserId: authUserId, useAdminRead: false };
  }
  if (userData?.role === 'admin') {
    const cookieStore = await cookies();
    const viewAs = cookieStore.get('levelup_view_as_coach_id')?.value?.trim();
    if (!viewAs) {
      return {
        ok: false,
        status: 400,
        error: 'Choose a coach in the header (preview as coach) to load that coach profile.',
      };
    }
    return { ok: true, athleteUserId: viewAs, useAdminRead: true };
  }
  return { ok: false, status: 403, error: 'Forbidden' };
}

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

    const { data: facilitiesForAnyCase } = await supabase
      .from('facilities')
      .select('*')
      .order('name');

    const resolved = await resolveProfileAthleteId(supabase, user.id);
    if (!resolved.ok) {
      const status = resolved.status;
      if (status === 400) {
        return NextResponse.json({
          athlete: null,
          facilities: facilitiesForAnyCase || [],
          error: resolved.error,
          needsCoachSelection: true,
        });
      }
      return NextResponse.json({ error: resolved.error }, { status });
    }

    const readClient = resolved.useAdminRead ? createAdminClient(tenant.slug) : supabase;

    const { data: athlete, error } = await readClient
      .from('athletes')
      .select('*')
      .eq('id', resolved.athleteUserId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Cell phone lives on users.phone (not athletes)
    const { data: userRow } = await readClient
      .from('users')
      .select('phone')
      .eq('id', resolved.athleteUserId)
      .maybeSingle();

    return NextResponse.json({
      athlete: athlete ? { ...athlete, phone: userRow?.phone ?? null } : null,
      facilities: facilitiesForAnyCase || [],
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
    const { weightClass, bio, credentials, photoUrl, facilityId, secondaryFacilityId, active, phone, venmoHandle, zelleEmail, photoFocusX, photoFocusY } = body;

    const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
    const focusX = photoFocusX != null ? clamp(Number(photoFocusX)) : undefined;
    const focusY = photoFocusY != null ? clamp(Number(photoFocusY)) : undefined;

    const resolved = await resolveProfileAthleteId(supabase, user.id);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const targetAthleteId = resolved.athleteUserId;

    // Cell phone is stored on users.phone (athletes.phone was removed)
    let phoneForUser: string | null | undefined = undefined;
    if (phone !== undefined) {
      const trimmed = String(phone).trim();
      if (trimmed === '') phoneForUser = null;
      else if (trimmed.replace(/\D/g, '').length >= 10) phoneForUser = trimmed;
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

    const applyUserPhone = async (): Promise<NextResponse | null> => {
      if (phoneForUser === undefined) return null;
      const { error: phoneErr } = await supabaseAdmin
        .from('users')
        .update({ phone: phoneForUser })
        .eq('id', targetAthleteId);
      if (phoneErr) {
        console.error('users.phone update error:', phoneErr);
        return NextResponse.json(
          { error: `Update failed: ${phoneErr.message}` },
          { status: 500 }
        );
      }
      return null;
    };

    // Get existing athlete data to preserve first_name, last_name, school
    // This MUST work with admin client (bypasses RLS)
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('athletes')
      .select('first_name, last_name, school')
      .eq('id', targetAthleteId)
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
      secondary_facility_id: secondaryFacilityId ?? null,
      active: active === true,
    };
    if (focusX !== undefined) updateData.photo_focus_x = focusX;
    if (focusY !== undefined) updateData.photo_focus_y = focusY;
    if (venmoHandle !== undefined) updateData.venmo_handle = venmoHandle === '' ? null : String(venmoHandle).trim();
    if (zelleEmail !== undefined) {
      updateData.zelle_email = zelleEmail === '' ? null : normalizeZelleInput(String(zelleEmail).trim()) ?? null;
    }

    // ALWAYS try UPDATE first (record should exist from signup)
    // Admin client bypasses RLS, so this should work
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from('athletes')
      .update(updateData)
      .eq('id', targetAthleteId)
      .select('id');

    // If UPDATE succeeded (affected at least 1 row), persist phone on users and return
    if (updateResult && updateResult.length > 0) {
      console.log('Profile updated successfully for user:', targetAthleteId);

      const phoneFail = await applyUserPhone();
      if (phoneFail) return phoneFail;

      // Verify the update by fetching the record
      const { data: verified } = await supabaseAdmin
        .from('athletes')
        .select('bio, photo_url, weight_class')
        .eq('id', targetAthleteId)
        .single();

      console.log('Verified profile data:', verified);

      return NextResponse.json({
        success: true,
        updated: true,
        athlete: verified,
      });
    }

    // Log if update returned 0 rows
    if (!updateError && (!updateResult || updateResult.length === 0)) {
      console.warn('UPDATE returned 0 rows for user:', targetAthleteId, 'Attempting INSERT...');
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
      .eq('id', targetAthleteId)
      .maybeSingle();

    const insertData = {
      id: targetAthleteId,
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
          .eq('id', targetAthleteId);

        if (retryUpdateError) {
          console.error('Retry update error:', retryUpdateError);
          return NextResponse.json({ 
            error: `Failed to save profile: ${retryUpdateError.message}` 
          }, { status: 500 });
        }
        const phoneFailRetry = await applyUserPhone();
        if (phoneFailRetry) return phoneFailRetry;
        return NextResponse.json({ success: true });
      } else {
        console.error('Insert error:', insertError);
        return NextResponse.json({ 
          error: `Failed to create profile: ${insertError.message}` 
        }, { status: 500 });
      }
    }

    // INSERT succeeded
    const phoneFailInsert = await applyUserPhone();
    if (phoneFailInsert) return phoneFailInsert;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating athlete profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

