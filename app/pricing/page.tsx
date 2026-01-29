import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export const metadata = {
  title: 'Pricing | The Guild',
  description: 'The Guild pricing.',
};

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>View wrestler profiles and session options for pricing details.</p>
          <p>
            <Link href="/browse" className="text-accent hover:underline">
              Browse wrestlers →
            </Link>
          </p>
          <p>
            <Link href="/" className="text-muted-foreground hover:text-accent hover:underline text-sm">
              ← Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
