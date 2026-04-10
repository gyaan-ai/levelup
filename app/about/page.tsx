import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackLink } from '@/components/back-link';

export const metadata = {
  title: 'About The Guild | The Guild',
  description: 'Elite wrestling technique instruction. Train with NCAA wrestlers and elite coaches in your community.',
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
            The Guild connects youth wrestlers with NCAA wrestlers and elite coaches in your
            community for private technique instruction. Mastery. Technique.
            Access the Elite.
          </p>
          <p>
            <BackLink
              fallbackHref="/"
              label="Back to home"
              className="text-accent hover:underline"
            />
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
