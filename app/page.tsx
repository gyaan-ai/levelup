import Link from 'next/link';
import { headers } from 'next/headers';
import { getTenantByDomain } from '@/config/tenants';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Star, ChevronDown } from 'lucide-react';
import { HomeHeroLogo } from '@/app/home-hero-logo';

export const metadata = {
  title: 'The Wrestling Guild | Access The Elite. Master Technique.',
  description:
    'Train with NCAA wrestlers and elite coaches for private technique instruction. Access the elite. Master the details that separate good from great.',
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
        
        {/* Secondary link */}
        <Link 
          href="/login" 
          className="mt-5 text-sm text-accent/60 hover:text-accent transition-colors"
        >
          Already have an account? Log in
        </Link>
        
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
              <h3 className="text-white font-semibold mb-1">Find Training</h3>
              <p className="text-white/60 text-sm">Browse private and small group sessions with elite coaches near you.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-bold text-sm">2</span>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Book & Pay</h3>
              <p className="text-white/60 text-sm">Reserve your spot. Secure checkout.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-bold text-sm">3</span>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Train & Improve</h3>
              <p className="text-white/60 text-sm">Elite instruction at top facilities. Real results.</p>
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
        <div className="max-w-sm mx-auto text-center">
          <p className="text-white/60 text-sm mb-3">
            NCAA wrestler or elite coach?
          </p>
          <Link 
            href="/signup?role=coach" 
            className="text-accent text-sm font-medium hover:underline"
          >
            Apply to join The Guild
          </Link>
        </div>
      </section>
    </main>
  );
}
