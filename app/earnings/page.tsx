import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export const metadata = {
  title: 'Earnings | The Guild',
  description: 'Earnings for NCAA wrestlers on The Guild.',
};

export default function EarningsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Earnings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>Earn while you train. Flexible scheduling around your competition calendar.</p>
          <p>
            <Link href="/signup" className="text-accent hover:underline">
              Join The Guild →
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
