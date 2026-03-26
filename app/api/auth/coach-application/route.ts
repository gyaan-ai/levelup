import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

export async function POST(req: NextRequest) {
  try {
    const hostname = req.headers.get('host') || '';
    const tenant = getTenantByDomain(hostname);
    
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      coachType,
      school,
      weightClass,
      yearsExperience,
      bio,
      hasSafeSport,
      safeSportExpiry,
      hasBackgroundCheck,
      backgroundCheckDate,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      tshirtSize,
      payoutMethod,
      venmoHandle,
      zelleContact,
      password,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !dateOfBirth || !coachType || !school || !bio || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['ncaa_athlete', 'club_hs_coach'].includes(coachType)) {
      return NextResponse.json({ error: 'Invalid coach type' }, { status: 400 });
    }

    if (!['venmo', 'zelle'].includes(payoutMethod)) {
      return NextResponse.json({ error: 'Invalid payout method' }, { status: 400 });
    }

    if (payoutMethod === 'venmo' && !venmoHandle) {
      return NextResponse.json({ error: 'Venmo handle is required' }, { status: 400 });
    }

    if (payoutMethod === 'zelle' && !zelleContact) {
      return NextResponse.json({ error: 'Zelle contact is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient(tenant.slug);

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user' },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // Insert into users table
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: userId,
      email: email.toLowerCase().trim(),
      role: 'coach',
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.replace(/\D/g, ''),
    });

    if (userError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: `Failed to create user profile: ${userError.message}` },
        { status: 500 }
      );
    }

    // Create athlete (coach) profile with pending status
    const { error: athleteError } = await supabaseAdmin.from('athletes').insert({
      id: userId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      school: school.trim(),
      coach_type: coachType,
      weight_class: weightClass || null,
      bio: bio.trim(),
      active: false, // Not active until approved
      status: 'pending', // Pending admin review
      date_of_birth: dateOfBirth,
      // Payout info
      payout_method: payoutMethod,
      venmo_handle: venmoHandle?.trim() || null,
      zelle_contact: zelleContact?.trim() || null,
      // Safety certs
      safesport_certified: hasSafeSport || false,
      safesport_expiry: safeSportExpiry || null,
      background_check: hasBackgroundCheck || false,
      background_check_date: backgroundCheckDate || null,
      // Emergency contact
      emergency_contact_name: emergencyContactName?.trim() || null,
      emergency_contact_phone: emergencyContactPhone?.replace(/\D/g, '') || null,
      emergency_contact_relationship: emergencyContactRelationship?.trim() || null,
      tshirt_size: tshirtSize || null,
      // Agreement
      agreement_signed_at: new Date().toISOString(),
    });

    if (athleteError) {
      await supabaseAdmin.from('users').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: `Failed to create coach profile: ${athleteError.message}` },
        { status: 500 }
      );
    }

    // TODO: Send notification email to admin about new application
    // TODO: Send confirmation email to coach

    return NextResponse.json({
      success: true,
      message: 'Application submitted successfully',
      user: {
        id: userId,
        email,
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('Coach application error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
