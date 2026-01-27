'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';
import { ArrowLeft, User, Clock, CheckCircle, Link2, Users, UserCircle } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { YouthWrestler } from '@/types';
import type { SessionMode } from '@/types';
import { getSessionPrice } from '@/lib/sessions';

/** 8am–9pm in 1-hour increments */
const TIME_SLOTS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM',
];

function timeTo24h(s: string): string {
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return '09:00';
  let h = parseInt(m[1], 10);
  const isPm = (m[3] || '').toUpperCase() === 'PM';
  if (isPm && h !== 12) h += 12;
  if (!isPm && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

interface Athlete {
  id: string;
  first_name: string;
  last_name: string;
  school: string;
  photo_url?: string;
}

interface Facility {
  id: string;
  name: string;
  address?: string;
  school: string;
}

interface BookingFlowProps {
  athlete: Athlete;
  facility: Facility | null;
  youthWrestlers: YouthWrestler[];
  tenantPricing: { oneOnOne: number; twoAthlete: number; groupRate: number };
}

export function BookingFlow({ athlete, facility, youthWrestlers, tenantPricing }: BookingFlowProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedWrestlers, setSelectedWrestlers] = useState<YouthWrestler[]>([]);
  const [sessionChoice, setSessionChoice] = useState<'1-on-1' | 'partner' | 'sibling' | null>(null);
  const [partnerOption, setPartnerOption] = useState<'invite' | 'open' | 'solo' | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sessionMode: SessionMode | null =
    sessionChoice === '1-on-1' ? 'private'
    : sessionChoice === 'sibling' ? 'sibling'
    : sessionChoice === 'partner' && partnerOption === 'invite' ? 'partner-invite'
    : sessionChoice === 'partner' && partnerOption === 'open' ? 'partner-open'
    : sessionChoice === 'partner' && partnerOption === 'solo' ? 'partner-invite' // same as invite for now
    : null;

  const priceInfo = sessionMode
    ? getSessionPrice(sessionMode, selectedWrestlers.length, tenantPricing)
    : null;
  const totalPrice = priceInfo?.total ?? 0;
  const pricePerParticipant = priceInfo?.pricePerParticipant;

  const numSelected = selectedWrestlers.length;
  const oneWrestler = numSelected === 1;
  const twoPlusWrestlers = numSelected >= 2;
  const isPartner = sessionChoice === 'partner';
  const needsPartnerOption = isPartner && partnerOption === null && oneWrestler;

  useEffect(() => {
    if (youthWrestlers.length === 1) {
      setSelectedWrestlers([youthWrestlers[0]]);
      setCurrentStep(2);
    }
  }, [youthWrestlers]);

  const toggleWrestler = (w: YouthWrestler) => {
    setSelectedWrestlers((prev) =>
      prev.some((x) => x.id === w.id)
        ? prev.filter((x) => x.id !== w.id)
        : [...prev, w]
    );
  };

  const handleContinue = () => {
    if (currentStep === 1 && numSelected > 0) setCurrentStep(2);
    else if (currentStep === 2) {
      if (isPartner && oneWrestler && !partnerOption) return; // must pick partner option
      if (sessionChoice && (!isPartner || partnerOption)) setCurrentStep(3);
    } else if (currentStep === 3 && selectedDate && selectedTime) setCurrentStep(4);
  };

  const handleBack = () => {
    if (currentStep === 2 && isPartner && partnerOption) {
      setPartnerOption(null);
      return;
    }
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  const canContinue =
    (currentStep === 1 && numSelected > 0) ||
    (currentStep === 2 && sessionChoice && (!isPartner || partnerOption)) ||
    (currentStep === 3 && !!selectedDate && !!selectedTime);

  const handlePay = async () => {
    if (!sessionMode || !selectedDate || !selectedTime || totalPrice <= 0) {
      alert('Please complete all steps.');
      return;
    }
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteId: athlete.id,
          facilityId: facility?.id ?? null,
          youthWrestlerIds: selectedWrestlers.map((w) => w.id),
          sessionMode,
          scheduledDate: dateStr,
          scheduledTime: timeTo24h(selectedTime),
          totalPrice,
          pricePerParticipant: pricePerParticipant ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      const params = new URLSearchParams({
        sessionId: data.sessionId,
        ...(data.partnerInviteCode && { code: data.partnerInviteCode }),
        ...(data.sessionMode && { mode: data.sessionMode }),
      });
      router.push(`/book/${athlete.id}/confirmed?${params.toString()}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const skillLabel = (w: YouthWrestler) =>
    w.skill_level ? w.skill_level.charAt(0).toUpperCase() + w.skill_level.slice(1) : 'Skill not set';

  const totalSteps = 4;
  const progressPct = (currentStep / totalSteps) * 100;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <Link
          href={`/athlete/${athlete.id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Profile
        </Link>
        <div className="flex items-center gap-4 mb-2">
          {athlete.photo_url ? (
            <img src={athlete.photo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">
              Book a Session with {athlete.first_name} {athlete.last_name}
            </h1>
            <p className="text-muted-foreground">{athlete.school}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 order-1 lg:order-none">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Step {currentStep} of {totalSteps}</span>
                <span className="text-sm text-muted-foreground">{Math.round(progressPct)}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </CardContent>
          </Card>

          {/* Step 1: Select Wrestler(s) */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Select Wrestler(s)</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Choose one or more youth wrestlers for this session.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {youthWrestlers.map((w) => {
                    const sel = selectedWrestlers.some((x) => x.id === w.id);
                    return (
                      <Card
                        key={w.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleWrestler(w)}
                        onKeyDown={(e) => e.key === 'Enter' && toggleWrestler(w)}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          sel ? 'ring-2 ring-levelup-primary border-levelup-primary bg-levelup-primary/5' : 'border-border hover:border-levelup-primary/50'
                        }`}
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          {w.photo_url ? (
                            <img src={w.photo_url} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <User className="h-7 w-7 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold">{w.first_name} {w.last_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {w.age != null ? `${w.age} yrs` : '—'} • {w.weight_class ? `${w.weight_class} lbs` : '—'} • {skillLabel(w)}
                            </p>
                          </div>
                          {sel && <CheckCircle className="h-5 w-5 text-levelup-primary shrink-0" />}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {numSelected > 0 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    {numSelected} wrestler{numSelected !== 1 ? 's' : ''} selected
                  </p>
                )}
                <Button onClick={handleContinue} disabled={numSelected === 0} className="w-full mt-6">
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Session Type (+ Partner option when Partner chosen) */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Choose Session Type</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {oneWrestler
                    ? 'Select 1-on-1 or a partner session.'
                    : 'Sibling session for multiple wrestlers.'}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {oneWrestler && (
                  <>
                    <Card
                      role="button"
                      tabIndex={0}
                      onClick={() => { setSessionChoice('1-on-1'); setPartnerOption(null); }}
                      onKeyDown={(e) => e.key === 'Enter' && (setSessionChoice('1-on-1'), setPartnerOption(null))}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        sessionChoice === '1-on-1' ? 'ring-2 ring-levelup-primary border-levelup-primary bg-levelup-primary/5' : 'border-border'
                      }`}
                    >
                      <CardContent className="p-5">
                        <h3 className="font-semibold text-lg">1-on-1 Private Session</h3>
                        <p className="text-muted-foreground text-sm mb-2">Focused individual attention</p>
                        <p className="text-2xl font-bold">${tenantPricing.oneOnOne}</p>
                      </CardContent>
                    </Card>
                    <Card
                      role="button"
                      tabIndex={0}
                      onClick={() => setSessionChoice('partner')}
                      onKeyDown={(e) => e.key === 'Enter' && setSessionChoice('partner')}
                      className={`relative cursor-pointer transition-all hover:shadow-md ${
                        sessionChoice === 'partner' ? 'ring-2 ring-levelup-primary border-levelup-primary bg-levelup-primary/5' : 'border-border'
                      }`}
                    >
                      <Badge className="absolute top-4 right-4 bg-levelup-primary text-xs">BEST VALUE</Badge>
                      <CardContent className="p-5 pr-24">
                        <h3 className="font-semibold text-lg">Partner Session</h3>
                        <p className="text-muted-foreground text-sm mb-2">Share the session with another wrestler</p>
                        <p className="text-2xl font-bold">$40 <span className="text-base font-normal text-muted-foreground">(Save $20!)</span></p>
                      </CardContent>
                    </Card>
                  </>
                )}
                {twoPlusWrestlers && (
                  <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => { setSessionChoice('sibling'); setPartnerOption(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && (setSessionChoice('sibling'), setPartnerOption(null))}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      sessionChoice === 'sibling' ? 'ring-2 ring-levelup-primary border-levelup-primary bg-levelup-primary/5' : 'border-border'
                    }`}
                  >
                    <CardContent className="p-5">
                      <h3 className="font-semibold text-lg">Sibling Session</h3>
                      <p className="text-muted-foreground text-sm mb-2">Train together with one coach</p>
                      <p className="text-2xl font-bold">
                        $40 per wrestler (Total: ${40 * numSelected})
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Step 2.5: How find partner? */}
                {needsPartnerOption && (
                  <div className="pt-4 border-t space-y-3">
                    <h4 className="font-semibold">How would you like to find a partner?</h4>
                    {[
                      { id: 'invite' as const, Icon: Link2, title: 'Invite a Specific Family', desc: 'Share a private link with someone you know.', sub: "They'll pay $40 when they join." },
                      { id: 'open' as const, Icon: Users, title: 'Leave Open for Others', desc: 'Other families can request to join.', sub: "You'll approve who trains with your wrestler." },
                      { id: 'solo' as const, Icon: UserCircle, title: 'Train Solo if No Partner', desc: 'Convert to 1-on-1 ($60) if spot doesn\'t fill.', sub: "You'll only pay the extra $20 if no partner joins." },
                    ].map(({ id, Icon, title, desc, sub }) => (
                      <Card
                        key={id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPartnerOption(id)}
                        onKeyDown={(e) => e.key === 'Enter' && setPartnerOption(id)}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          partnerOption === id ? 'ring-2 ring-levelup-primary border-levelup-primary bg-levelup-primary/5' : 'border-border'
                        }`}
                      >
                        <CardContent className="p-4 flex items-start gap-4">
                          <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-medium">{title}</h4>
                            <p className="text-sm text-muted-foreground">{desc}</p>
                            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                          </div>
                          {partnerOption === id && <CheckCircle className="h-5 w-5 text-levelup-primary shrink-0" />}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="flex gap-4 mt-6">
                  <Button variant="outline" onClick={handleBack} className="flex-1">Back</Button>
                  <Button onClick={handleContinue} disabled={!canContinue} className="flex-1">Continue</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Date & Time */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Pick Date & Time</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Choose a future date and time (8am–9pm).
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < startOfDay(new Date())}
                    className="rounded-md border"
                  />
                </div>
                {selectedDate && (
                  <div>
                    <h3 className="font-semibold mb-3">Time</h3>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {TIME_SLOTS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedTime(t)}
                          className={`p-2 rounded-lg border text-sm transition-all ${
                            selectedTime === t ? 'border-levelup-primary bg-levelup-primary text-white' : 'border-border hover:border-levelup-primary/50'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedDate && selectedTime && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {format(selectedDate, 'EEEE, MMMM d, yyyy')} at {selectedTime}
                  </p>
                )}
                <div className="flex gap-4 mt-6">
                  <Button variant="outline" onClick={handleBack} className="flex-1">Back</Button>
                  <Button onClick={handleContinue} disabled={!canContinue} className="flex-1">Continue</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Review & Confirm */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Review & Confirm</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Confirm details and pay to book.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Coach</p>
                  <div className="flex items-center gap-3 mt-1">
                    {athlete.photo_url ? (
                      <img src={athlete.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <span className="font-medium">{athlete.first_name} {athlete.last_name}</span>
                    <span className="text-muted-foreground">({athlete.school})</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Wrestler(s)</p>
                  <p className="mt-1">{selectedWrestlers.map((w) => `${w.first_name} ${w.last_name}`).join(', ')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Session Type</p>
                  <p className="mt-1">
                    {sessionMode === 'private' && '1-on-1 Private'}
                    {sessionMode === 'sibling' && 'Sibling Session'}
                    {sessionMode === 'partner-invite' && 'Partner Session (invite link)'}
                    {sessionMode === 'partner-open' && 'Partner Session (open to join requests)'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date & Time</p>
                  <p className="mt-1">
                    {selectedDate && selectedTime && `${format(selectedDate, 'EEEE, MMMM d, yyyy')} at ${selectedTime}`}
                  </p>
                </div>
                {facility && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Location</p>
                    <p className="mt-1">{facility.name}</p>
                    {facility.address && <p className="text-sm text-muted-foreground">{facility.address}</p>}
                  </div>
                )}
                <div className="pt-4 border-t flex justify-between items-center">
                  <span className="font-semibold">Price</span>
                  <span className="text-2xl font-bold">${totalPrice.toFixed(2)}</span>
                </div>
                {(sessionMode === 'partner-invite' || sessionMode === 'partner-open') && (
                  <p className="text-sm text-muted-foreground">
                    Second spot: partner will pay $40 when they join.
                  </p>
                )}
                <div className="flex gap-4 mt-4">
                  <Button variant="outline" onClick={handleBack} className="flex-1">Back</Button>
                  <Button onClick={handlePay} disabled={loading} className="flex-1">
                    {loading ? 'Booking…' : `Pay $${totalPrice.toFixed(2)} and Book Session`}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Payment uses Stripe. For now, session is saved as &quot;pending payment&quot; and Stripe will be connected next.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary sidebar */}
        <div className="lg:col-span-1 order-2 lg:order-none">
          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b">
                {athlete.photo_url ? (
                  <img src={athlete.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{athlete.first_name} {athlete.last_name}</p>
                  <p className="text-sm text-muted-foreground">{athlete.school}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Wrestler(s)</p>
                {numSelected > 0 ? (
                  <div className="space-y-1">
                    {selectedWrestlers.map((w) => (
                      <div key={w.id} className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {w.first_name} {w.last_name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not selected</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Session Type</p>
                <p className="text-sm">
                  {sessionMode === 'private' && '1-on-1 Private'}
                  {sessionMode === 'sibling' && 'Sibling Session'}
                  {sessionMode === 'partner-invite' && 'Partner (invite)'}
                  {sessionMode === 'partner-open' && 'Partner (open)'}
                  {!sessionMode && 'Not selected'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Date & Time</p>
                {selectedDate && selectedTime ? (
                  <p className="text-sm flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(selectedDate, 'MMM d, yyyy')} at {selectedTime}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not selected</p>
                )}
              </div>
              {facility && (
                <div>
                  <p className="text-sm font-medium mb-2">Location</p>
                  <p className="text-sm">{facility.name}</p>
                </div>
              )}
              <div className="pt-4 border-t flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold">
                  {sessionMode ? `$${totalPrice.toFixed(2)}` : '—'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
