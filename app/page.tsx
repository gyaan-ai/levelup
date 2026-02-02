import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Users, Award, Shield } from 'lucide-react';
import { AddToHomeScreen } from '@/components/add-to-home-screen';

export const metadata = {
  title: 'The Guild | Elite Wrestling Technique Instruction',
  description:
    'Train with NCAA wrestlers in your community for private technique instruction. Master your wrestling through elite-level coaching.',
};

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative bg-black min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-black to-gray-900" />
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-center lg:text-left">
                <div className="mb-8">
                  <h1 className="text-6xl md:text-7xl lg:text-8xl font-serif font-bold text-accent mb-4 tracking-wide">
                    THE GUILD
                  </h1>
                  <div className="h-1 w-32 bg-accent mx-auto lg:mx-0" />
                </div>
                <p className="text-xl md:text-2xl text-white font-light tracking-wide mb-10 uppercase">
                  Mastery. Technique. Access the Elite.
                </p>
                <p className="text-base sm:text-lg text-white/80 mb-8 sm:mb-12 max-w-xl mx-auto lg:mx-0">
                  Train with NCAA wrestlers in your community for private technique
                  instruction. Master the details that separate good from elite.
                </p>
                <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center lg:justify-start">
                  <Button
                    size="xl"
                    variant="premium"
                    asChild
                    className="gold-glow-hover"
                  >
                    <Link href="/browse">Browse Elite Coaches</Link>
                  </Button>
                  <Button
                    size="xl"
                    variant="outline"
                    asChild
                    className="bg-transparent text-white border-white hover:bg-white hover:text-black"
                  >
                    <Link href="/#how-it-works">How It Works</Link>
                  </Button>
                  <AddToHomeScreen />
                </div>
              </div>
              <div className="relative flex items-center justify-center min-h-[280px] lg:min-h-[360px]">
                <Image
                  src="/logos/guild-g.png"
                  alt="The Guild — gold G lettermark with wrestlers"
                  width={360}
                  height={360}
                  className="object-contain w-full max-w-[280px] lg:max-w-[360px] h-auto"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How The Guild Works */}
      <section id="how-it-works" className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-black mb-4">
              How The Guild Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Three steps to elite technique mastery
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            <Card className="p-6 sm:p-8 text-center border-2 hover:border-accent transition-all">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">
                Browse Elite Coaches
              </h3>
              <p className="text-muted-foreground">
                NCAA wrestlers from top programs. View credentials, specialties,
                and reviews.
              </p>
            </Card>
            <Card className="p-6 sm:p-8 text-center border-2 hover:border-accent transition-all">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Award className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">
                Book Private Sessions
              </h3>
              <p className="text-muted-foreground">
                One-on-one technique instruction at college facilities. Flexible
                scheduling.
              </p>
            </Card>
            <Card className="p-6 sm:p-8 text-center border-2 hover:border-accent transition-all">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-black mb-4">
                Master Your Technique
              </h3>
              <p className="text-muted-foreground">
                Learn from active competitors. Precision coaching focused on
                technical excellence.
              </p>
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
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-black mb-4">
              Why Choose The Guild
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {[
              {
                title: 'NCAA Wrestlers',
                text: 'Train with current NCAA wrestlers. Active competitors who bring real experience to every session.',
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
                  <h3 className="text-xl font-bold text-black">{item.title}</h3>
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

      {/* For NCAA Wrestlers */}
      <section className="py-20 bg-black text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
              Are You an NCAA Wrestler?
            </h2>
            <p className="text-xl sm:text-2xl text-accent mb-6 sm:mb-8">
              Share your expertise. Earn while you compete.
            </p>
            <p className="text-base sm:text-xl text-white/90 mb-6 sm:mb-8">
              The Guild connects NCAA wrestlers with youth athletes for private
              technique instruction. Earn money, build coaching experience, and
              give back to the wrestling community.
            </p>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 mb-10 max-w-2xl mx-auto text-left">
              <h3 className="text-2xl font-semibold mb-6">Requirements:</h3>
              <ul className="space-y-3 text-lg">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-1" />
                  <span>Current NCAA wrestler</span>
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

      {/* Final CTA */}
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-r from-accent to-accent-hover">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-black mb-6">
            Ready to Master Your Technique?
          </h2>
          <p className="text-xl text-black/80 mb-10 max-w-2xl mx-auto">
            Join The Guild and train with NCAA wrestlers in your community.
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
