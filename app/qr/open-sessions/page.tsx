import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { OpenSessionsQrActions } from './open-sessions-qr-actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Open sessions QR | The Guild',
  description: 'Scan to browse and book open training sessions.',
};

async function publicOriginFromRequest(): Promise<string> {
  const headersList = await headers();
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const host =
    headersList.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    headersList.get('host') ||
    '';
  const proto =
    headersList.get('x-forwarded-proto') ||
    (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** Public Training list — open sessions browse (not a single session). */
export default async function OpenSessionsQrPage() {
  const origin = await publicOriginFromRequest();
  const targetUrl = `${origin}/training?tab=sessions`;

  const qrDataUrl = await QRCode.toDataURL(targetUrl, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0a0a0a', light: '#ffffff' },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container max-w-lg mx-auto px-4 py-10 pb-16">
        <h1 className="text-2xl font-bold font-serif text-center mb-1">Open sessions</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Scan to see all bookable sessions. Use this QR on flyers, cards, and weekly graphics.
        </p>

        <div className="flex justify-center rounded-xl border border-border bg-card p-6 shadow-sm print:border-0 print:shadow-none print:p-4">
          {/* Data URL from qrcode — no next/image optimization needed */}
          <img
            src={qrDataUrl}
            alt="QR code: scan to open the list of bookable training sessions"
            width={512}
            height={512}
            className="w-full max-w-[280px] sm:max-w-[320px] h-auto aspect-square"
          />
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6 break-all font-mono px-1">
          {targetUrl}
        </p>

        <div className="mt-6">
          <OpenSessionsQrActions targetUrl={targetUrl} qrDataUrl={qrDataUrl} />
        </div>

        <p className="text-xs text-muted-foreground text-center mt-8 leading-relaxed">
          Set <code className="text-[11px] bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_APP_URL</code> in
          production so printed materials always use your real domain.
        </p>
      </div>
    </div>
  );
}
