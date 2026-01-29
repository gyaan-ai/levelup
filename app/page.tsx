import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Search,
  Calendar,
  Trophy,
  CheckCircle,
  Star,
} from 'lucide-react';

export default function Home() {
  return (
    <main className="flex flex-col">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary via-primary to-[#2a3a44] min-h-[90vh] flex items-center">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight">
                THE CREW
              </h1>
              <div className="h-1 w-32 bg-accent mx-auto mt-4" />
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl text-white font-semibold mb-6">
              Outwork Everyone
            </h2>
            <p className="text-xl md:text-2xl text-white/80 mb-10 max-w-3xl mx-auto">
              Train with D1 college wrestlers from UNC and NC State who know what
              it takes to put in the work. Private lessons focused on technique,
              conditioning, and mental toughness.
            </p>
            <p className="text-lg text-white/60 mb-12">
              No shortcuts. Just real wrestlers putting in real work.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="xl" asChild className="orange-glow-hover">
                <Link href="/browse">Meet Our Crew Coaches →</Link>
              </Button>
              <Button
                size="xl"
                variant="outline"
                asChild
                className="bg-transparent text-white border-white hover:bg-white hover:text-primary"
              >
                <Link href="/#how-it-works">How It Works</Link>
              </Button>
            </div>
            <div className="mt-16 max-w-5xl mx-auto">
              <div className="relative rounded-lg overflow-hidden shadow-2xl bg-primary/50 aspect-video flex items-center justify-center">
                <span className="text-white/60 text-sm">
                  Hero image: add /public/images/hero-training.jpg
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How The Crew Works */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">
              How The Crew Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Three simple steps to join your wrestling crew
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="p-8 text-center hover:border-accent transition-all">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-primary mb-4">
                Find Your Coach
              </h3>
              <p className="text-muted-foreground">
                Browse D1 wrestlers from UNC and NC State. Real college athletes
                who&apos;ve put in the work and know how to compete.
              </p>
            </Card>
            <Card className="p-8 text-center hover:border-accent transition-all">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-primary mb-4">
                Book Your Session
              </h3>
              <p className="text-muted-foreground">
                Schedule private or partner sessions at college wrestling rooms.
                Flexible times. No excuses.
              </p>
            </Card>
            <Card className="p-8 text-center hover:border-accent transition-all">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-primary mb-4">
                Put in the Work
              </h3>
              <p className="text-muted-foreground">
                Show up. Train hard. Get better. Track your progress and watch
                your work ethic pay off.
              </p>
            </Card>
          </div>
          <div className="text-center mt-12">
            <Button size="lg" asChild>
              <Link href="/signup">Join The Crew →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Your Wrestling Crew */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1 rounded-lg overflow-hidden bg-primary/10 aspect-video flex items-center justify-center">
              <span className="text-muted-foreground text-sm">
                Add /public/images/crew-training.jpg
              </span>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-4xl md:text-5xl font-bold text-primary mb-6">
                Your Wrestling Crew
              </h2>
              <div className="space-y-4 text-lg text-muted-foreground">
                <p>
                  Wrestling is a grind. You need people who&apos;ve been there—who
                  know what it takes to show up day after day and put in the
                  work.
                </p>
                <p>
                  The Crew connects you with D1 college athletes who are still in
                  the trenches. They&apos;re not retired legends—they&apos;re active
                  wrestlers who train every day and compete at the highest level.
                </p>
                <p className="text-xl font-semibold text-primary">
                  This is your crew. Your training partners. Your path to becoming
                  unstoppable.
                </p>
              </div>
              <div className="mt-8">
                <Button size="lg" asChild>
                  <Link href="/about">Learn About The Crew →</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Parents Choose The Crew */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">
              Why Parents Choose The Crew
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                title: 'D1 College Athletes',
                text: "Train with wrestlers competing at the D1 level. They know what it takes because they're doing it right now.",
              },
              {
                title: 'Work Ethic First',
                text: "We don't promise shortcuts. We teach your wrestler to outwork everyone through discipline and dedication.",
              },
              {
                title: 'Real Facilities',
                text: 'Sessions at UNC and NC State wrestling rooms. Train where the best train.',
              },
              {
                title: 'Flexible Scheduling',
                text: 'Early morning grind or evening sessions. We work around your schedule.',
              },
              {
                title: 'Affordable Training',
                text: 'Private or partner sessions. $40-60 per session. Credit pools available.',
              },
              {
                title: 'Track Progress',
                text: "See your wrestler's improvement week by week. Work ethic shows results.",
              },
            ].map((item) => (
              <Card key={item.title} className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                  <h3 className="text-xl font-bold text-primary">{item.title}</h3>
                </div>
                <p className="text-muted-foreground">{item.text}</p>
              </Card>
            ))}
          </div>
          <div className="text-center mt-12">
            <Button size="lg" asChild>
              <Link href="/browse">Meet Our Crew Coaches →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Become a Crew Coach */}
      <section className="py-20 bg-primary text-white relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Become a Crew Coach
            </h2>
            <p className="text-2xl text-accent mb-8">
              Earn money. Share the grind. Build the next generation.
            </p>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
              Crew Coaches are D1 college wrestlers who train youth athletes
              through private lessons. Earn money while you&apos;re still
              competing, give back to the sport, and help build work ethic in the
              next generation.
            </p>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 mb-10 max-w-2xl mx-auto text-left">
              <h3 className="text-2xl font-semibold mb-6">Requirements:</h3>
              <ul className="space-y-3 text-lg">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                  <span>Current D1 college wrestler</span>
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
                  Crew Coaches earn{' '}
                  <span className="text-accent font-bold">$50-65 per session</span>{' '}
                  with flexible scheduling around your training.
                </p>
              </div>
            </div>
            <Button size="xl" asChild>
              <Link href="/signup">Apply to Become a Crew Coach →</Link>
            </Button>
            <div className="mt-16 max-w-2xl mx-auto">
              <blockquote className="text-lg italic text-white/80 border-l-4 border-accent pl-6">
                &quot;Coaching for The Crew lets me earn money while staying in
                my own training rhythm. These kids work hard and it motivates me
                to keep grinding too.&quot;
              </blockquote>
              <p className="mt-4 text-white/60">
                — Jake Miller, Crew Coach
                <br />
                UNC Wrestling, 157 lbs
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">
              What Families Say About The Crew
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="p-8 border-l-4 border-accent">
              <CardContent className="p-0">
                <div className="mb-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-5 h-5 fill-accent text-accent"
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground italic">
                    &quot;The Crew taught my son what real work ethic looks
                    like. Training with a D1 athlete showed him there are no
                    shortcuts—just dedication and grind.&quot;
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-primary">Sarah Thompson</p>
                  <p>Parent • Son trains with Coach Marcus (UNC)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="p-8 border-l-4 border-accent">
              <CardContent className="p-0">
                <div className="mb-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-5 h-5 fill-accent text-accent"
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground italic">
                    &quot;My daughter&apos;s confidence skyrocketed after joining
                    The Crew. She doesn&apos;t just learn technique—she learns to
                    outwork her competition.&quot;
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-primary">David Chen</p>
                  <p>Parent • Daughter trains with Coach Emma (NC State)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="p-8 border-l-4 border-accent">
              <CardContent className="p-0">
                <div className="mb-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-5 h-5 fill-accent text-accent"
                      />
                    ))}
                  </div>
                  <p className="text-muted-foreground italic">
                    &quot;Coaching for The Crew keeps me sharp while earning
                    money. Watching these kids put in the work motivates me in
                    my own training.&quot;
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-primary">Jake Miller</p>
                  <p>Crew Coach • UNC Wrestling, 157 lbs</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-accent">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-6">
            Ready to Join The Crew?
          </h2>
          <p className="text-xl text-primary/80 mb-10 max-w-2xl mx-auto">
            Browse our Crew Coaches and book your first session. Private lessons
            starting at $60.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="xl" variant="charcoal" asChild>
              <Link href="/browse">Meet Our Crew Coaches →</Link>
            </Button>
            <Button
              size="xl"
              variant="charcoal"
              className="bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-white"
              asChild
            >
              <Link href="/#how-it-works">How It Works</Link>
            </Button>
          </div>
          <div className="pt-8 border-t-2 border-primary/30 max-w-md mx-auto">
            <p className="text-primary/80 mb-2">Already a member?</p>
            <Link
              href="/login"
              className="text-primary font-semibold hover:underline text-lg"
            >
              Login →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
