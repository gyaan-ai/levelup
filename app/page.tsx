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
      <section className="relative bg-gradient-to-br from-primary via-primary to-[#0d2d4a] min-h-[90vh] flex items-center">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight">
                THE GUILD
              </h1>
              <div className="h-1 w-32 bg-accent mx-auto mt-4" />
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl text-white font-semibold mb-6">
              Where Masters Train the Next Generation
            </h2>
            <p className="text-xl md:text-2xl text-white/80 mb-10 max-w-3xl mx-auto">
              D1 college athletes from UNC and NC State pass down the craft of
              wrestling through private lessons.
            </p>
            <p className="text-lg text-white/60 mb-12 italic">
              This isn&apos;t just coaching. It&apos;s mentorship.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="xl" asChild>
                <Link href="/browse">Meet Our Guild Masters →</Link>
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

      {/* How The Guild Works */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">
              How The Guild Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Three simple steps to transform your wrestler&apos;s training
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="p-8 text-center hover:border-accent transition-all">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-primary mb-4">
                Meet the Masters
              </h3>
              <p className="text-muted-foreground">
                Browse D1 wrestlers from UNC and NC State. View their
                credentials, coaching philosophy, and reviews from other
                families.
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
                Schedule private or partner sessions at real college wrestling
                rooms. Flexible times that work for your family.
              </p>
            </Card>
            <Card className="p-8 text-center hover:border-accent transition-all">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-primary mb-4">
                Watch Them Grow
              </h3>
              <p className="text-muted-foreground">
                Track progress as they develop under master coaching. Build
                confidence, technique, and a championship mindset.
              </p>
            </Card>
          </div>
          <div className="text-center mt-12">
            <Button size="lg" asChild>
              <Link href="/signup">Join The Guild →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Master-Apprentice Tradition */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1 rounded-lg overflow-hidden bg-primary/10 aspect-video flex items-center justify-center">
              <span className="text-muted-foreground text-sm">
                Add /public/images/master-apprentice.jpg
              </span>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-4xl md:text-5xl font-bold text-primary mb-6">
                The Master-Apprentice Tradition
              </h2>
              <div className="space-y-4 text-lg text-muted-foreground">
                <p>
                  For centuries, guilds have represented the highest standards
                  of craftsmanship—where masters pass their knowledge to
                  apprentices through hands-on training.
                </p>
                <p>
                  The Guild Wrestling continues this tradition. Our D1 college
                  athletes don&apos;t just teach technique. They mentor the next
                  generation, sharing the lessons learned from thousands of
                  hours on the mat.
                </p>
                <p className="text-xl font-semibold text-primary italic">
                  This is more than wrestling. This is the craft.
                </p>
              </div>
              <div className="mt-8">
                <Button size="lg" asChild>
                  <Link href="/about">Learn About The Guild →</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Parents Choose The Guild */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">
              Why Parents Choose The Guild
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                title: 'Guild Masters',
                text: 'Train with wrestlers competing at the D1 level. These are the masters of their craft, now passing it down.',
              },
              {
                title: 'Proven Standards',
                text: 'SafeSport certified, background checked, and verified college athletes. Guild-certified excellence.',
              },
              {
                title: 'Real Facilities',
                text: 'Sessions at UNC and NC State wrestling rooms. Your wrestler trains where the best train.',
              },
              {
                title: 'Flexible Scheduling',
                text: "Morning, evening, or weekend sessions. Book times that work for your family's schedule.",
              },
              {
                title: 'Affordable Options',
                text: 'Private sessions or partner training. $40-60 per session. Credit pools for best value.',
              },
              {
                title: 'Track Progress',
                text: "Dashboard shows your wrestler's growth, session history, and master feedback over time.",
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
              <Link href="/browse">Meet Our Guild Masters →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Become a Guild Master */}
      <section className="py-20 bg-primary text-white relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Become a Guild Master
            </h2>
            <p className="text-2xl text-accent mb-8">
              Share your craft. Earn while you train.
            </p>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
              Guild Masters are D1 college wrestlers who pass down their
              knowledge to the next generation through private lessons. Earn
              money, build coaching experience, and give back to the wrestling
              community.
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
                  Guild Masters earn{' '}
                  <span className="text-accent font-bold">$50-65 per session</span>{' '}
                  with flexible scheduling.
                </p>
              </div>
            </div>
            <Button size="xl" asChild>
              <Link href="/signup">Apply to Become a Guild Master →</Link>
            </Button>
            <div className="mt-16 max-w-2xl mx-auto">
              <blockquote className="text-lg italic text-white/80 border-l-4 border-accent pl-6">
                &quot;Being a Guild Master lets me give back while earning.
                It&apos;s the best side job I&apos;ve ever had. Watching these
                kids improve week by week is incredibly rewarding.&quot;
              </blockquote>
              <p className="mt-4 text-white/60">
                — Jake Miller, Guild Master
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
              What Families Say About The Guild
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
                    &quot;The Guild has transformed my son&apos;s wrestling.
                    Training with a D1 athlete gave him confidence and technique
                    we couldn&apos;t find anywhere else.&quot;
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-primary">Sarah Thompson</p>
                  <p>Parent • Son trains with Guild Master Marcus (UNC)</p>
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
                    &quot;The master-apprentice model is perfect. My daughter
                    doesn&apos;t just learn moves—she learns what it takes to
                    compete at the highest level.&quot;
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-primary">David Chen</p>
                  <p>Parent • Daughter trains with Guild Master Emma (NC State)</p>
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
                    &quot;Being a Guild Master lets me share what I&apos;ve
                    learned and help young wrestlers avoid the mistakes I made.
                    It&apos;s incredibly rewarding.&quot;
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold text-primary">Jake Miller</p>
                  <p>Guild Master • UNC Wrestling, 157 lbs</p>
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
            Ready to Join The Guild?
          </h2>
          <p className="text-xl text-primary/80 mb-10 max-w-2xl mx-auto">
            Browse our Guild Masters and book your first session. Private
            lessons starting at $60.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="xl" variant="navy" asChild>
              <Link href="/browse">Meet Our Guild Masters →</Link>
            </Button>
            <Button
              size="xl"
              variant="navy"
              className="bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-white"
              asChild
            >
              <Link href="/#how-it-works">How It Works</Link>
            </Button>
          </div>
          <div className="pt-8 border-t-2 border-primary/20 max-w-md mx-auto">
            <p className="text-primary/70 mb-2">Already a member?</p>
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
