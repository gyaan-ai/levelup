import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTenantConfig } from '@/config/tenants';
import Link from 'next/link';

export const metadata = {
  title: 'Contact | The Guild',
  description: 'Contact The Guild.',
};

export default function ContactPage() {
  const tenant = getTenantConfig('nc-united');
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
            <Link href="/" className="text-accent hover:underline">
              ← Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
