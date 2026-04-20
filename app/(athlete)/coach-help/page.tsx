import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackLink } from '@/components/back-link';
import { Button } from '@/components/ui/button';
import { CalendarClock, ExternalLink, LayoutDashboard, Smartphone } from 'lucide-react';

export const metadata = {
  title: 'Coach help | The Guild',
  description: 'Mobile shortcut video and guides for availability, sessions, and payouts.',
};

/** Guild default: mobile shortcut tutorial (override with NEXT_PUBLIC_COACH_HELP_HOME_SCREEN_VIDEO_URL). */
const DEFAULT_HOME_SCREEN_VIDEO_URL =
  'https://www.loom.com/share/1d60dcd9bcbf4724ad8f3d4039e5b7ab';

function youtubeEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    if ((u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') && u.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

/** Loom share URL → embed (in-page player). */
function loomEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'www.loom.com' && u.hostname !== 'loom.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const shareIdx = parts.indexOf('share');
    if (shareIdx >= 0 && parts[shareIdx + 1]) {
      return `https://www.loom.com/embed/${parts[shareIdx + 1]}`;
    }
    if (parts[0] === 'embed' && parts[1]) {
      return `https://www.loom.com/embed/${parts[1]}`;
    }
    return null;
  } catch {
    return null;
  }
}

function videoEmbedSrc(url: string): string | null {
  return youtubeEmbedSrc(url) ?? loomEmbedSrc(url);
}

export default async function CoachHelpPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);

  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/coach-help');

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'coach' && userData?.role !== 'admin') {
    if (userData?.role === 'parent') redirect('/browse');
    redirect('/login');
  }

  const homeScreenVideoUrl =
    process.env.NEXT_PUBLIC_COACH_HELP_HOME_SCREEN_VIDEO_URL?.trim() || DEFAULT_HOME_SCREEN_VIDEO_URL;
  const embedSrc = videoEmbedSrc(homeScreenVideoUrl);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <BackLink fallbackHref="/athlete-dashboard" label="Back to Schedule" />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground font-serif md:text-3xl">Coach help</h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Start with the short video below to add LevelUp to your phone (home screen shortcut). Then use the guides for
          availability and sessions.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="border-[#D4AF37]/40 shadow-sm">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#D4AF37] mb-1">Start here</p>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-[#D4AF37]" aria-hidden />
              <CardTitle className="text-lg">Add LevelUp to your phone</CardTitle>
            </div>
            <CardDescription>
              Put the Guild on your home screen so opening your schedule is one tap — same idea as installing an app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <>
              {embedSrc ? (
                <div className="rounded-lg overflow-hidden border bg-black aspect-video">
                  <iframe
                    title="How to add LevelUp to your home screen"
                    src={embedSrc}
                    className="w-full h-full min-h-[200px]"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    allowFullScreen
                  />
                </div>
              ) : null}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Button asChild className="min-h-[44px] bg-[#D4AF37] hover:bg-[#c9a432] text-black font-semibold w-full sm:w-auto">
                  <a
                    href={homeScreenVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2"
                  >
                    {embedSrc ? 'Open in new tab' : 'Watch the video'}
                    <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  </a>
                </Button>
                {!embedSrc ? (
                  <span className="text-xs sm:text-sm">
                    Opens your video host in a new tab — use a YouTube or Loom watch/share link for an in-page player.
                  </span>
                ) : null}
              </div>
            </>
            <p className="text-xs border-t border-border/60 pt-3">
              After you save the shortcut, open LevelUp once and sign in so the browser keeps you logged in.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[#D4AF37]" aria-hidden />
              <CardTitle className="text-lg">Availability</CardTitle>
            </div>
            <CardDescription>
              Parents book and request you based on the hours you publish (Eastern time).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-2">
              <li>Open <strong className="text-foreground">Availability</strong> and add dated openings (start/end times).</li>
              <li>If a time already appears under <strong className="text-foreground">Upcoming openings</strong>, you do not need to add it again — remove it there if you want to change it.</li>
              <li>Optional: block whole days off at the bottom of that page.</li>
            </ul>
            <Button asChild variant="outline" className="min-h-[44px] w-full sm:w-auto mt-2">
              <Link href="/availability">Go to Availability</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-[#D4AF37]" aria-hidden />
              <CardTitle className="text-lg">Schedule, sessions &amp; earnings</CardTitle>
            </div>
            <CardDescription>Day-to-day coaching workflow in the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Schedule</strong> — who is booked, pending requests, and today&apos;s sessions.
              </li>
              <li>
                <strong className="text-foreground">Create session</strong> — small-group or partner sessions parents can join.
              </li>
              <li>
                <strong className="text-foreground">Dashboard</strong> — earnings snapshot and reviews (not your hourly calendar).
              </li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link href="/athlete-dashboard">Schedule</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link href="/coach-sessions">My sessions</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link href="/coach-dashboard">Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile &amp; payouts</CardTitle>
            <CardDescription>Keep your public coach page and payout details current.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link href="/profile">Edit profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
