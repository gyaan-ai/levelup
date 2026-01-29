import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Requirements | The Guild',
  description: 'Requirements to join The Guild as an NCAA wrestler.',
};

export default function RequirementsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Requirements for NCAA Wrestlers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-accent flex-shrink-0" />
              Current NCAA wrestler
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-accent flex-shrink-0" />
              SafeSport & background check certified
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-accent flex-shrink-0" />
              Commit to 10 sessions in 6 months
            </li>
          </ul>
          <p>
            <Link href="/signup" className="text-accent hover:underline">
              Apply to Join The Guild →
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
