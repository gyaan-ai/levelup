import { headers } from 'next/headers';
import { Playfair_Display } from 'next/font/google';
import { getTenantByDomain } from '@/config/tenants';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata = {
  title: 'The Guild | Elite Wrestling Technique Instruction',
  description:
    'Train with NCAA wrestlers in your community for private technique instruction. Master your wrestling through elite-level coaching.',
  keywords:
    'the guild wrestling, wrestling lessons, NCAA wrestlers, elite technique, private lessons',
  icons: {
    icon: '/favicon.ico',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    viewportFit: 'cover',
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
      <html lang="en" className={playfair.variable}>
        <body className="font-sans">
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
    <html lang="en" className={playfair.variable}>
      <body className="flex flex-col min-h-screen font-sans">
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

