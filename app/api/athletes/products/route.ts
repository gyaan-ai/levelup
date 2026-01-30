import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

// GET /api/athletes/products - Get products and athlete's selections
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

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'athlete') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient(tenant.slug);

    // Get athlete ID
    const { data: athlete } = await admin
      .from('athletes')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Get active products
    const { data: products } = await admin
      .from('products')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });

    // Get athlete's product selections
    const { data: athleteProducts } = await admin
      .from('athlete_products')
      .select('product_id, enabled')
      .eq('athlete_id', athlete.id);

    return NextResponse.json({
      products: products || [],
      athleteProducts: athleteProducts || [],
    });
  } catch (e) {
    console.error('Athlete products GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/athletes/products - Toggle a product for athlete
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

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'athlete') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { productId, enabled } = body;

    if (!productId || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = createAdminClient(tenant.slug);

    // Get athlete ID
    const { data: athlete } = await admin
      .from('athletes')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    // Upsert athlete product selection
    const { error } = await admin
      .from('athlete_products')
      .upsert({
        athlete_id: athlete.id,
        product_id: productId,
        enabled,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'athlete_id,product_id',
      });

    if (error) {
      console.error('Athlete products upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Athlete products PUT error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
