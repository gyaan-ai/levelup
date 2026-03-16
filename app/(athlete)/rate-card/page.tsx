import { headers } from 'next/headers';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getTenantByDomain } from '@/config/tenants';
import { ServiceBuilder } from '@/components/service-builder';

export default async function RateCardPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  const recommendedRates = tenant?.pricing
    ? {
        oneOnOne: tenant.pricing.oneOnOne,
        twoAthlete: tenant.pricing.twoAthlete,
        groupRate: tenant.pricing.groupRate,
      }
    : undefined;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link
        href="/athlete-dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Pricing & Session Types</h1>
        <p className="text-muted-foreground mt-1">
          Build what you offer: duration (30m, 1hr, 1:30, 2hr), type (private, partner, small group), and price per person. Guild share is ~17% of what the parent pays; you receive the rest.
        </p>
      </div>
      <ServiceBuilder recommendedRates={recommendedRates} />
    </div>
  );
}
