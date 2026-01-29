import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export const metadata = {
  title: 'About The Guild | The Guild',
  description: 'Elite wrestling technique instruction. Train with NCAA wrestlers in your community.',
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">About The Guild</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            The Guild connects youth wrestlers with NCAA wrestlers in your
            community for private technique instruction. Mastery. Technique.
            Access the Elite.
          </p>
          <p>
            <Link href="/" className="text-accent hover:underline">
              ← Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
