import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTenantConfig } from '@/config/tenants';
import { BackLink } from '@/components/back-link';

export const metadata = {
  title: 'Contact | The Guild',
  description: 'Contact The Guild.',
};

export default function ContactPage() {
  const tenant = getTenantConfig('guild');
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            <strong>Email:</strong>{' '}
            <a href={`mailto:${tenant.supportEmail}`} className="text-accent hover:underline">
              {tenant.supportEmail}
            </a>
          </p>
          <p>
            <strong>Phone:</strong> {tenant.phone}
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
