import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Calendar } from 'lucide-react';
import { headers } from 'next/headers';
import { getTenantByDomain } from '@/config/tenants';
import { getStripeInstance } from '@/lib/stripe/webhooks';
import { createAdminClient } from '@/lib/supabase/admin';
import { rosterSnapshotFromYouthRow } from '@/lib/session-roster-snapshot';
import { createNotification } from '@/lib/notifications';
import { sendCoachNewSignupSms } from '@/lib/twilio';
import { formatEST } from '@/lib/format-date';

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

    const metadata = checkoutSession.metadata || {};
    if (metadata.cart_checkout !== 'true') {
      redirect('/training');
    }

    const sessionIds = metadata.session_ids?.split(',') || [];
    const wrestlerId = metadata.youth_wrestler_id;
    const parentId = metadata.parent_id;
    const pricesStr = metadata.session_prices || '';
    
    // Parse prices: "sessionId:price,sessionId:price"
    const priceMap: Record<string, number> = {};
    pricesStr.split(',').forEach((item) => {
      const [sid, price] = item.split(':');
      if (sid && price) priceMap[sid] = Number(price);
    });

    sessionCount = sessionIds.length;

    if (sessionIds.length > 0 && wrestlerId && parentId) {
      const admin = createAdminClient(tenant.slug);

      // Get wrestler info for roster snapshot
      const { data: yw } = await admin
        .from('youth_wrestlers')
        .select('id, first_name, last_name, photo_url')
        .eq('id', wrestlerId)
        .single();

      const snapshot = rosterSnapshotFromYouthRow(yw || {});

      for (const sessionId of sessionIds) {
        // Check if already registered
        const { data: existing } = await admin
          .from('session_participants')
          .select('id')
          .eq('session_id', sessionId)
          .eq('youth_wrestler_id', wrestlerId)
          .maybeSingle();

        if (!existing) {
          const price = priceMap[sessionId] ?? 30;
          
          // Insert participant
          await admin.from('session_participants').insert({
            session_id: sessionId,
            youth_wrestler_id: wrestlerId,
            parent_id: parentId,
            paid: true,
            amount_paid: price,
            stripe_checkout_session_id: stripe_cs,
            ...snapshot,
          });

          // Increment participant count
          const { data: sess } = await admin
            .from('sessions')
            .select('current_participants, athlete_id, scheduled_datetime')
            .eq('id', sessionId)
            .single();

          if (sess) {
            const current = (sess as { current_participants?: number }).current_participants ?? 0;
            await admin.from('sessions').update({
              current_participants: current + 1,
              updated_at: new Date().toISOString(),
            }).eq('id', sessionId);

            // Notify coach
            const coachId = (sess as { athlete_id?: string }).athlete_id;
            const dt = (sess as { scheduled_datetime?: string }).scheduled_datetime;
            if (coachId && coachId !== parentId) {
              const dateStr = dt ? formatEST(new Date(dt), 'EEE MMM d, h:mm a') : 'your session';
              await createNotification(admin, {
                user_id: coachId,
                type: 'session_booked',
                title: 'Someone signed up for your session',
                body: `New signup for ${dateStr}. Check My sessions.`,
                data: { session_id: sessionId },
              }).catch(() => {});
              await sendCoachNewSignupSms(admin, coachId, dateStr).catch(() => {});
            }
          }
        }
      }
    }
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
              <Link href="/training">
                Book More Sessions
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
