'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ServiceBuilder } from '@/components/service-builder';

export default function RateCardPage() {
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
          Build what you offer: duration (30m, 1hr, 1:30, 2hr), type (private, partner, small group), and price per person. Platform fee is 10%; you receive 90%.
        </p>
      </div>
      <ServiceBuilder />
    </div>
  );
}
