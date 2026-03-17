import Link from 'next/link';
import { headers } from 'next/headers';
import { getTenantByDomain } from '@/config/tenants';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users, Award, Shield, Search, Star } from 'lucide-react';
import { EarlyAccessForm } from '@/app/early-access-form';
import { HomeHeroLogo } from '@/app/home-hero-logo';

export const metadata = {
  title: 'The Guild | Elite Wrestling Technique Instruction',
  description:
    'Train with NCAA wrestlers and elite coaches in your community for private technique instruction. Master your wrestling through top-level coaching.',
};

export default async function HomePage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  const logoSrc = tenant?.logo ?? '/logos/guild-g.png';

  let featuredReviews: { id: string; rating: number; comment: string | null; coach_name: string }[] = [];
  if (tenant) {
    const supabase = await createClient(tenant.slug);
    const { data: reviews } = await supabase
      .from('reviews_anonymous')
      .select('id, athlete_id, rating, comment')
      .gte('rating', 4)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6);
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
    <main>
      {/* Hero */}
      <section className="relative bg-black min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-gray-900" />
        {/* Mobile: Log in top-right on the same screen as THE GUILD / Browse — tell users "tap Log in top right" */}
        <Link
          href="/login"
          className="absolute top-4 right-4 z-20 md:hidden py-2.5 px-4 rounded-full bg-accent text-black font-semibold text-sm shadow-lg hover:bg-accent/90"
        >
          Log in
        </Link>
        <div className="container mx-auto px-4 py-12 sm:py-20 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-center lg:text-left">
                <div className="mb-4 sm:mb-8">
                  <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif font-bold text-accent mb-4 tracking-wide">
                    THE GUILD
                  </h1>
                  <div className="h-1 w-32 bg-accent mx-auto lg:mx-0" />
                </div>
                <p className="text-lg sm:text-xl md:text-2xl text-white font-light tracking-wide mb-4 sm:mb-10 uppercase">
                  Mastery. Technique. Access the Elite.
                </p>
                <p className="text-base sm:text-lg text-white/80 mb-4 sm:mb-12 max-w-xl mx-auto lg:mx-0">
                  Train with NCAA wrestlers and elite coaches in your community for private technique
                  instruction. Master the details that separate good from elite.
                </p>
                <p className="text-sm text-white/70 mb-3 sm:mb-4 text-center lg:text-left">
                  Already have an account?{' '}
                  <Link href="/login" className="text-accent font-semibold underline underline-offset-2 hover:text-accent/90">
                    Log in
                  </Link>
                </p>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center lg:justify-start">
                  <Button
                    size="xl"
                    variant="premium"
                    asChild
                    className="gold-glow-hover w-full sm:w-auto min-w-0 sm:min-w-[140px]"
                  >
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button
                    size="xl"
                    variant="premium"
                    asChild
                    className="gold-glow-hover w-full sm:w-auto min-w-0 sm:min-w-[140px] bg-white/10 text-white border-2 border-accent hover:bg-accent hover:text-black"
                  >
                    <Link href="/browse">Browse Elite Coaches</Link>
                  </Button>
                  <Button
                    size="xl"
                    variant="outline"
                    asChild
                    className="w-full sm:w-auto bg-transparent text-white border-accent text-accent hover:bg-accent hover:text-black"
                  >
                    <Link href="/signup?role=coach">Coach? Join The Guild</Link>
                  </Button>
                  <Button
                    size="xl"
                    variant="outline"
                    asChild
                    className="w-full sm:w-auto bg-transparent text-white border-white hover:bg-white hover:text-black"
                  >
                    <Link href="/#how-it-works">How It Works</Link>
                  </Button>
                </div>
              </div>
              <div className="relative flex items-center justify-center min-h-[280px] lg:min-h-[360px]">
                <HomeHeroLogo src={logoSrc} alt="The Guild — gold G lettermark with wrestlers" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What parents say — gold stars */}
      {featuredReviews.length > 0 && (
        <section className="py-12 sm:py-16 bg-muted/40">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-foreground mb-2 flex items-center justify-center gap-2">
                <Star className="h-8 w-8 fill-accent text-accent" />
                What parents say
              </h2>
              <p className="text-muted-foreground">Real feedback from parents after sessions</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {featuredReviews.slice(0, 3).map((r) => (
                <Card key={r.id} className="p-6 border-2 border-accent/20">
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i <= r.rating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`}
                      />
                    ))}
                  </div>
                  {r.comment && (
                    <p className="text-foreground font-medium mb-2">&ldquo;{r.comment}&rdquo;</p>
                  )}
                  <p className="text-sm text-muted-foreground">— Parent, session with {r.coach_name}</p>
                </Card>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button variant="outline" size="lg" asChild>
                <Link href="/browse">Browse coaches & reviews</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* How The Guild Works */}
      <section id="how-it-works" className="py-12 sm:py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
              How The Guild Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Three steps to elite technique mastery
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            <Card className="p-6 sm:p-8 text-center border-2 hover:border-accent transition-all">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Browse Elite Coaches
              </h3>
              <p className="text-muted-foreground">
                NCAA athletes and elite coaches from top programs. View credentials, specialties,
                and reviews.
              </p>
            </Card>
            <Card className="p-6 sm:p-8 text-center border-2 hover:border-accent transition-all">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Award className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Book Private Sessions
              </h3>
              <p className="text-muted-foreground">
                One-on-one technique instruction at top facilities. Flexible
                scheduling.
              </p>
            </Card>
            <Card className="p-6 sm:p-8 text-center border-2 hover:border-accent transition-all">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Master Your Technique
              </h3>
              <p className="text-muted-foreground">
                Learn from active competitors. Precision coaching focused on
                technical excellence.
              </p>
            </Card>
          </div>
          <div className="max-w-2xl mx-auto mt-10">
            <Card className="p-6 sm:p-8 border-2 border-accent/30 bg-accent/5">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="w-14 h-14 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Search className="w-7 h-7 text-accent" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-1">
                    Find open sessions to join
                  </h3>
                  <p className="text-muted-foreground text-sm sm:text-base">
                    Search for small group sessions and open partner sessions. Join as a partner or enter a group—request to join and the session owner approves.
                  </p>
                  <Button size="sm" variant="premium" asChild className="mt-3">
                    <Link href="/small-group-sessions">Browse small group & partner sessions</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
          <div className="text-center mt-12">
            <Button size="lg" variant="premium" asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Why The Guild */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
              Why Choose The Guild
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {[
              {
                title: 'NCAA Athletes & Coaches',
                text: 'Train with current NCAA wrestlers and elite club coaches. Active competitors and experienced coaches who bring real experience to every session.',
              },
              {
                title: 'Technical Mastery',
                text: 'Precision instruction focused on technique refinement. Master the details that make the difference at high levels.',
              },
              {
                title: 'Elite Facilities',
                text: 'Train at college wrestling rooms. Experience the environment where elite coaches develop.',
              },
              {
                title: 'Verified & Safe',
                text: 'All wrestlers are background checked and SafeSport certified. Your wrestler\'s safety is our priority.',
              },
              {
                title: 'Flexible Scheduling',
                text: 'Book sessions that work for your schedule. Morning, afternoon, or evening availability.',
              },
              {
                title: 'Track Progress',
                text: 'Monitor development over time. See technical improvements and get feedback from elite coaches.',
              },
            ].map((item) => (
              <Card key={item.title} className="p-6 border-l-4 border-accent">
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                  <h3 className="text-xl font-bold text-foreground">{item.title}</h3>
                </div>
                <p className="text-muted-foreground">{item.text}</p>
              </Card>
            ))}
          </div>
          <div className="text-center mt-12">
            <Button size="lg" variant="premium" asChild>
              <Link href="/browse">Browse Elite Coaches</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* For NCAA Wrestlers & Coaches */}
      <section className="py-20 bg-black text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
              Are You an NCAA Wrestler or Coach?
            </h2>
            <p className="text-xl sm:text-2xl text-accent mb-6 sm:mb-8">
              Share your expertise. Earn while you compete or coach.
            </p>
            <p className="text-base sm:text-xl text-white/90 mb-6 sm:mb-8">
              The Guild connects NCAA wrestlers and elite coaches with youth athletes for private
              technique instruction. Earn money, build coaching experience, and
              give back to the wrestling community.
            </p>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 mb-10 max-w-2xl mx-auto text-left">
              <h3 className="text-2xl font-semibold mb-6">Requirements:</h3>
              <ul className="space-y-3 text-lg">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                  <span>Current NCAA athlete or qualified club coach</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                  <span>SafeSport & background check certified</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                  <span>Commit to 10 sessions in 6 months</span>
                </li>
              </ul>
              <div className="mt-8 pt-6 border-t border-white/20">
                <p className="text-xl">
                  Earn while you train. Flexible scheduling around your
                  competition calendar.
                </p>
              </div>
            </div>
            <Button size="xl" variant="premium" asChild>
              <Link href="/signup">Apply to Join The Guild</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Early Access */}
      <section id="early-access" className="py-16 md:py-20 bg-black text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-4">
              Early Access
            </h2>
            <p className="text-lg sm:text-xl text-white/80 mb-8">
              Help us test The Guild and be first to train with elite coaches. Join the list for early adopters and testers.
            </p>
            <EarlyAccessForm />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-r from-accent to-accent-hover">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-black mb-6">
            Ready to Master Your Technique?
          </h2>
          <p className="text-xl text-black/80 mb-10 max-w-2xl mx-auto">
            Join The Guild and train with NCAA wrestlers and elite coaches in your community.
            Private technique sessions.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button size="xl" variant="black" asChild>
              <Link href="/browse">Browse Elite Coaches</Link>
            </Button>
            <Button
              size="xl"
              variant="outline"
              className="bg-transparent border-2 border-black text-black hover:bg-black hover:text-white"
              asChild
            >
              <Link href="/#how-it-works">How It Works</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
