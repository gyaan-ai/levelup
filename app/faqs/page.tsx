import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackLink } from '@/components/back-link';

export const metadata = {
  title: 'FAQs | The Guild',
  description: 'Frequently asked questions about The Guild.',
};

export default function FAQsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">FAQs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>FAQs coming soon.</p>
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
