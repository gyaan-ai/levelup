import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

export async function POST(req: NextRequest) {
  try {
    const hostname = req.headers.get('host') || '';
    const tenant = getTenantByDomain(hostname);
    
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { email, password, role, firstName, lastName, school } = body;

    // Validate required fields
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: 'Email, password, and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['parent', 'athlete', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // For athletes, require additional fields
    if (role === 'athlete' && (!firstName || !lastName || !school)) {
      return NextResponse.json(
        { error: 'First name, last name, and school are required for athletes' },
        { status: 400 }
      );
    }

    // Create Supabase admin client (to create user)
    const supabaseAdmin = createAdminClient(tenant.slug);

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for now (can change later)
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user' },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // Insert into users table
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email,
        role,
      });

    if (userError) {
      // Rollback: delete auth user if user table insert fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: `Failed to create user profile: ${userError.message}` },
        { status: 500 }
      );
    }

    // If athlete, create athlete profile
    if (role === 'athlete') {
      const { error: athleteError } = await supabaseAdmin
        .from('athletes')
        .insert({
          id: userId,
          first_name: firstName,
          last_name: lastName,
          school,
          active: false, // Will be activated after certification verification
        });

      if (athleteError) {
        // Rollback: delete user and auth user
        await supabaseAdmin.from('users').delete().eq('id', userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: `Failed to create athlete profile: ${athleteError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        role,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

