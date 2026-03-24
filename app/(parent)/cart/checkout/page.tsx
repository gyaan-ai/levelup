import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { CartCheckoutClient } from './cart-checkout-client';

export const metadata = {
  title: 'Checkout | The Guild',
  description: 'Complete your session bookings',
};

export default async function CartCheckoutPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  
  if (!tenant) {
    redirect('/');
  }

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/cart/checkout');
  }

  // Fetch user's wrestlers for selection
  const { data: wrestlers } = await supabase
    .from('youth_wrestlers')
    .select('id, first_name, last_name, photo_url')
    .eq('parent_id', user.id)
    .order('first_name');

  return (
    <div className="container max-w-3xl py-8 px-4">
      <CartCheckoutClient 
        wrestlers={wrestlers ?? []} 
        userEmail={user.email ?? ''} 
      />
    </div>
  );
}
