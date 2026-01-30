import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

// GET /api/admin/products - List all products
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

    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient(tenant.slug);
    const { data: products, error } = await admin
      .from('products')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products });
  } catch (e) {
    console.error('Products GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/products - Create a new product
export async function POST(req: NextRequest) {
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

    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, slug, description, parent_price, athlete_payout, min_participants, max_participants, active } = body;

    if (!name || !slug || parent_price == null || athlete_payout == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = createAdminClient(tenant.slug);
    
    // Get max display_order
    const { data: existing } = await admin
      .from('products')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);
    
    const nextOrder = ((existing?.[0]?.display_order ?? 0) + 1);

    const { data: product, error } = await admin
      .from('products')
      .insert({
        name,
        slug,
        description: description || null,
        parent_price,
        athlete_payout,
        min_participants: min_participants || 1,
        max_participants: max_participants || 1,
        active: active ?? true,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Product with this slug already exists' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product });
  } catch (e) {
    console.error('Products POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
