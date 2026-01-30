import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

// PUT /api/admin/products/[id] - Update a product
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    // Only include fields that are provided
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.parent_price !== undefined) updateData.parent_price = body.parent_price;
    if (body.athlete_payout !== undefined) updateData.athlete_payout = body.athlete_payout;
    if (body.min_participants !== undefined) updateData.min_participants = body.min_participants;
    if (body.max_participants !== undefined) updateData.max_participants = body.max_participants;
    if (body.active !== undefined) updateData.active = body.active;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;

    const admin = createAdminClient(tenant.slug);
    const { data: product, error } = await admin
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (e) {
    console.error('Products PUT error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/products/[id] - Delete a product
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const { error } = await admin
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Products DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
