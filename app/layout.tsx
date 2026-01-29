import { headers } from 'next/headers';
import { getTenantByDomain } from '@/config/tenants';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import './globals.css';

export const metadata = {
  title: 'The Guild | Where Masters Train the Next Generation',
  description:
    'Join The Guild Wrestling. Private lessons with D1 college athletes from UNC and NC State in Raleigh, NC. Book your session today.',
  keywords:
    'the guild wrestling, wrestling lessons Raleigh, private wrestling coach, D1 coaches, youth wrestling NC',
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  
  if (!tenant) {
    return (
      <html lang="en">
        <body>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Tenant not found</h1>
              <p className="text-muted-foreground">Unable to resolve tenant for domain: {host}</p>
            </div>
          </div>
        </body>
      </html>
    );
  }
  
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <ThemeProvider tenant={tenant}>
          <AuthProvider tenantSlug={tenant.slug}>
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

