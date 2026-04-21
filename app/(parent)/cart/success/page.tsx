import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Calendar } from 'lucide-react';
import { headers } from 'next/headers';
import { getTenantByDomain } from '@/config/tenants';
import { getStripeInstance } from '@/lib/stripe/webhooks';

export const metadata = {
  title: 'Booking Confirmed | The Guild',
  description: 'Your sessions have been booked',
};

export default async function CartSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe_cs?: string }>;
}) {
  const { stripe_cs } = await searchParams;

  if (!stripe_cs) {
    redirect('/training');
  }

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/training');

  const stripe = getStripeInstance(tenant.slug);

  let sessionCount = 0;

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(stripe_cs);

    if (checkoutSession.payment_status !== 'paid') {
      redirect('/training');
    }

    const meta = checkoutSession.metadata || {};
    if (meta.cart_checkout !== 'true') {
      redirect('/training');
    }

    const sessionIds = meta.session_ids?.split(',').filter(Boolean) || [];
    sessionCount = sessionIds.length;
  } catch (e) {
    console.error('Cart success page error:', e);
  }

  return (
    <div className="container max-w-lg py-12 px-4">
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-16 w-16 mx-auto mb-6 text-green-500" />
          <h1 className="text-2xl font-bold mb-2">You&apos;re all set!</h1>
          <p className="text-muted-foreground mb-8">
            {sessionCount > 1
              ? `${sessionCount} sessions have been booked successfully.`
              : 'Your session has been booked successfully.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/bookings" className="gap-2">
                <Calendar className="h-4 w-4" />
                View My Bookings
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/training">Book More Sessions</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
