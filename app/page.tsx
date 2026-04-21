import Link from 'next/link';
import { headers } from 'next/headers';
import { getTenantByDomain } from '@/config/tenants';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Star, ChevronDown } from 'lucide-react';
import { HomeHeroLogo } from '@/app/home-hero-logo';
import { CoachMapSection } from '@/components/map/coach-map-section';

export const metadata = {
  title: 'The Wrestling Guild | Access Elite Master Technique',
  description:
    'Train with NCAA wrestlers and elite coaches for private technique instruction. Access elite master technique that separates good from great.',
};

export default async function HomePage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  const logoSrc = tenant?.logo ?? '/logos/guild-bronze.jpg';

  // Fetch reviews for social proof
  let featuredReviews: { id: string; rating: number; comment: string | null; coach_name: string }[] = [];
  if (tenant) {
    const supabase = await createClient(tenant.slug);
    const { data: reviews } = await supabase
      .from('reviews_anonymous')
      .select('id, athlete_id, rating, comment')
      .gte('rating', 4)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3);
    if (reviews && reviews.length > 0) {
      const athleteIds = [...new Set(reviews.map((r) => r.athlete_id))];
      const { data: athletes } = await supabase
        .from('athletes')
        .select('id, first_name, last_name')
        .in('id', athleteIds);
      const coachById = new Map((athletes ?? []).map((a) => [a.id, `${a.first_name} ${a.last_name}`]));
      featuredReviews = reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        coach_name: coachById.get(r.athlete_id) ?? 'Coach',
      }));
    }
  }

  return (
    <main className="min-h-screen bg-black">
      {/* Hero - Full screen, mobile-first, Hall of Fame aesthetic */}
      <section className="relative min-h-[100svh] flex flex-col items-center justify-center px-6 py-12 bg-black">
        
        {/* Logo */}
        <div className="mb-6">
          <HomeHeroLogo src={logoSrc} alt="The Wrestling Guild" />
        </div>
        
        {/* Brand */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-black text-accent tracking-wide uppercase text-center mb-4">
          The Guild
        </h1>
        
        {/* Tagline */}
        <p className="text-sm sm:text-base text-accent/90 font-semibold tracking-[0.15em] uppercase mb-10">
          Access Elite Master Technique
        </p>
        
        {/* Single Primary CTA */}
        <Button
          size="lg"
          variant="premium"
          asChild
          className="gold-glow-hover w-full max-w-[280px] text-base py-6 border-2 border-accent"
        >
          <Link href="/browse">Find Training</Link>
        </Button>
        
        {/* Secondary CTA */}
        <Button
          size="lg"
          variant="secondary"
          asChild
          className="mt-4 w-full max-w-[280px] border border-white/20 bg-white/10 text-white hover:bg-white/15"
        >
          <Link href="/login">Log in</Link>
        </Button>

        <Button
          size="lg"
          variant="outline"
          asChild
          className="mt-3 w-full max-w-[280px] border-2 border-accent/60 bg-transparent text-accent hover:bg-accent/10"
        >
          <Link href="/signup/coach">Apply as a coach</Link>
        </Button>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-6 w-6 text-accent/40" />
        </div>
      </section>

      {/* Social Proof - Parents trust us */}
      {featuredReviews.length > 0 && (
        <section className="py-12 px-6 border-t border-accent/20 bg-black">
          <p className="text-center text-xs text-white/40 uppercase tracking-widest mb-6">
            What Parents Say
          </p>
          <div className="max-w-lg mx-auto space-y-6">
            {featuredReviews.slice(0, 2).map((r) => (
              <div key={r.id} className="text-center">
                <div className="flex justify-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i <= r.rating ? 'fill-accent text-accent' : 'text-white/20'}`}
                    />
                  ))}
                </div>
                {r.comment && (
                  <p className="text-white/80 text-sm italic mb-1">&ldquo;{r.comment}&rdquo;</p>
                )}
                <p className="text-xs text-white/40">Session with {r.coach_name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {tenant && <CoachMapSection tenantSlug={tenant.slug} />}

      {/* How It Works - 3 simple steps, training-focused */}
      <section id="how-it-works" className="py-12 px-6 border-t border-accent/20 bg-black">
        <p className="text-center text-xs text-white/40 uppercase tracking-widest mb-8">
          How It Works
        </p>
        <div className="max-w-sm mx-auto space-y-8">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-bold text-sm">1</span>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Pick a coach &amp; book</h3>
              <p className="text-white/60 text-sm">
                Private or partner session—invite your partner when you choose partner. Use the map to find someone who
                fits your area and style.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-bold text-sm">2</span>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Or join a posted session</h3>
              <p className="text-white/60 text-sm">
                Browse open partner slots and small groups on the coach map when a coach has posted one—optional if you
                prefer your own time from step 1.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-bold text-sm">3</span>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Train &amp; improve</h3>
              <p className="text-white/60 text-sm">Elite instruction at top facilities. Secure checkout when you book.</p>
            </div>
          </div>
        </div>
        
        <div className="mt-10 text-center">
          <Button
            size="lg"
            variant="premium"
            asChild
            className="w-full max-w-[280px]"
          >
            <Link href="/browse">Find Training</Link>
          </Button>
        </div>
      </section>

      {/* For Coaches - minimal footer-style */}
      <section className="py-10 px-6 border-t border-accent/20 bg-black">
        <div className="max-w-sm mx-auto text-center space-y-3">
          <p className="text-white/60 text-sm">
            NCAA wrestler or elite coach?
          </p>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="w-full max-w-[280px] border-accent/60 text-accent hover:bg-accent/10"
          >
            <Link href="/signup/coach">Apply to join The Guild</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
