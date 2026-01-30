import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { ProductsClient } from './products-client';

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  return new Set(
    raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
}

export default async function AdminProductsPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  // Check admin access
  if (userData?.role !== 'admin') {
    const adminEmails = getAdminEmails();
    const emailLower = (user.email ?? '').toLowerCase();
    if (!adminEmails.has(emailLower)) {
      redirect('/');
    }
  }

  const admin = createAdminClient(tenant.slug);

  // Fetch products
  const { data: products, error } = await admin
    .from('products')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Products fetch error:', error);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-serif text-primary">Products & Pricing</h1>
        <p className="text-muted-foreground mt-1">
          Manage session products, pricing, and revenue breakdown
        </p>
      </div>
      <ProductsClient products={products || []} />
    </div>
  );
}
