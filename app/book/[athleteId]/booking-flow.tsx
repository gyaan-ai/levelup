'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';
import { ArrowLeft, User, Clock, CheckCircle, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { YouthWrestler } from '@/types';

type SessionType = '1-on-1' | '2-athlete' | 'group';

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
  tenantPricing: {
    oneOnOne: number;
    twoAthlete: number;
    groupRate: number;
  };
}

const TIME_SLOTS = {
  morning: ['8:00 AM', '9:00 AM', '10:00 AM'],
  afternoon: ['1:00 PM', '2:00 PM', '3:00 PM'],
  evening: ['5:00 PM', '6:00 PM', '7:00 PM'],
};

export function BookingFlow({
  athlete,
  facility,
  youthWrestlers,
  tenantPricing,
}: BookingFlowProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedWrestler, setSelectedWrestler] = useState<YouthWrestler | null>(null);
  const [selectedWrestler2, setSelectedWrestler2] = useState<YouthWrestler | null>(null);
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Auto-select wrestler if only one
  useEffect(() => {
    if (youthWrestlers.length === 1) {
      setSelectedWrestler(youthWrestlers[0]);
      setCurrentStep(2);
    }
  }, [youthWrestlers]);

  // Calculate total price
  const calculatePrice = (): number => {
    if (!sessionType) return 0;
    
    switch (sessionType) {
      case '1-on-1':
        return tenantPricing.oneOnOne;
      case '2-athlete':
        return tenantPricing.twoAthlete;
      case 'group':
        return tenantPricing.groupRate; // Per athlete, but we'll show as total for now
      default:
        return 0;
    }
  };

  const handleContinue = () => {
    if (currentStep === 1 && selectedWrestler) {
      setCurrentStep(2);
    } else if (currentStep === 2 && sessionType) {
      if (sessionType === '2-athlete' && !selectedWrestler2) {
        alert('Please select a second youth wrestler for the 2-athlete session');
        return;
      }
      setCurrentStep(3);
    }
  };

  const handlePayment = () => {
    if (!selectedDate || !selectedTime) {
      alert('Please select a date and time');
      return;
    }
    alert('Stripe integration coming next!');
  };

  const canContinue = () => {
    if (currentStep === 1) return !!selectedWrestler;
    if (currentStep === 2) {
      if (sessionType === '2-athlete') {
        return !!selectedWrestler2;
      }
      return !!sessionType;
    }
    if (currentStep === 3) {
      return !!selectedDate && !!selectedTime;
    }
    return false;
  };

  const getSessionTypeDescription = (type: SessionType) => {
    switch (type) {
      case '1-on-1':
        return 'Focused individual attention';
      case '2-athlete':
        return 'Best value! Train with a partner';
      case 'group':
        return 'Learn with peers';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
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
            <img
              src={athlete.photo_url}
              alt={`${athlete.first_name} ${athlete.last_name}`}
              className="w-16 h-16 rounded-full object-cover"
            />
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
        {/* Main Booking Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Indicator */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium">
                  Step {currentStep} of 3
                </span>
                <span className="text-sm text-muted-foreground">
                  {Math.round((currentStep / 3) * 100)}% Complete
                </span>
              </div>
              <Progress value={(currentStep / 3) * 100} className="h-2" />
            </CardContent>
          </Card>

          {/* Step 1: Select Youth Wrestler */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Select Youth Wrestler</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {youthWrestlers.map((wrestler) => (
                    <button
                      key={wrestler.id}
                      onClick={() => setSelectedWrestler(wrestler)}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        selectedWrestler?.id === wrestler.id
                          ? 'border-levelup-primary bg-levelup-primary/5'
                          : 'border-border hover:border-levelup-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {wrestler.photo_url ? (
                          <img
                            src={wrestler.photo_url}
                            alt={`${wrestler.first_name} ${wrestler.last_name}`}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold">
                            {wrestler.first_name} {wrestler.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {wrestler.age ? `${wrestler.age} yrs` : 'Age not set'} •{' '}
                            {wrestler.weight_class || 'Weight not set'} •{' '}
                            {wrestler.skill_level || 'Skill not set'}
                          </p>
                          {selectedWrestler?.id === wrestler.id && (
                            <CheckCircle className="h-5 w-5 text-levelup-primary mt-2" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <Button
                  onClick={handleContinue}
                  disabled={!canContinue()}
                  className="w-full mt-6"
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select Session Type */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Select Session Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 1-on-1 */}
                <button
                  onClick={() => setSessionType('1-on-1')}
                  className={`w-full p-6 border-2 rounded-lg text-left transition-all ${
                    sessionType === '1-on-1'
                      ? 'border-levelup-primary bg-levelup-primary/5'
                      : 'border-border hover:border-levelup-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">1-on-1 Private</h3>
                      <p className="text-muted-foreground mb-2">
                        {getSessionTypeDescription('1-on-1')}
                      </p>
                      <p className="text-2xl font-bold">
                        ${tenantPricing.oneOnOne}
                      </p>
                    </div>
                    {sessionType === '1-on-1' && (
                      <CheckCircle className="h-6 w-6 text-levelup-primary" />
                    )}
                  </div>
                </button>

                {/* 2-Athlete */}
                <button
                  onClick={() => setSessionType('2-athlete')}
                  className={`w-full p-6 border-2 rounded-lg text-left transition-all relative ${
                    sessionType === '2-athlete'
                      ? 'border-levelup-primary bg-levelup-primary/5'
                      : 'border-border hover:border-levelup-primary/50'
                  }`}
                >
                  <Badge className="absolute top-4 right-4 bg-levelup-primary">
                    RECOMMENDED
                  </Badge>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-20">
                      <h3 className="font-semibold text-lg mb-1">2-Athlete Partner Session</h3>
                      <p className="text-muted-foreground mb-2">
                        {getSessionTypeDescription('2-athlete')}
                      </p>
                      <p className="text-2xl font-bold">
                        ${tenantPricing.twoAthlete} total
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        ${tenantPricing.twoAthlete / 2} per athlete
                      </p>
                    </div>
                    {sessionType === '2-athlete' && (
                      <CheckCircle className="h-6 w-6 text-levelup-primary" />
                    )}
                  </div>
                </button>

                {/* Small Group */}
                <button
                  onClick={() => setSessionType('group')}
                  className={`w-full p-6 border-2 rounded-lg text-left transition-all ${
                    sessionType === 'group'
                      ? 'border-levelup-primary bg-levelup-primary/5'
                      : 'border-border hover:border-levelup-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">
                        Small Group (3-5 athletes)
                      </h3>
                      <p className="text-muted-foreground mb-2">
                        {getSessionTypeDescription('group')}
                      </p>
                      <p className="text-2xl font-bold">
                        ${tenantPricing.groupRate} per athlete
                      </p>
                    </div>
                    {sessionType === 'group' && (
                      <CheckCircle className="h-6 w-6 text-levelup-primary" />
                    )}
                  </div>
                </button>

                {/* 2nd Wrestler Selection for 2-athlete */}
                {sessionType === '2-athlete' && (
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle className="text-base">Select Second Youth Wrestler</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {youthWrestlers
                          .filter((w) => w.id !== selectedWrestler?.id)
                          .map((wrestler) => (
                            <button
                              key={wrestler.id}
                              onClick={() => setSelectedWrestler2(wrestler)}
                              className={`p-4 border-2 rounded-lg text-left transition-all ${
                                selectedWrestler2?.id === wrestler.id
                                  ? 'border-levelup-primary bg-levelup-primary/5'
                                  : 'border-border hover:border-levelup-primary/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {wrestler.photo_url ? (
                                  <img
                                    src={wrestler.photo_url}
                                    alt={`${wrestler.first_name} ${wrestler.last_name}`}
                                    className="w-12 h-12 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                    <User className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <h4 className="font-medium">
                                    {wrestler.first_name} {wrestler.last_name}
                                  </h4>
                                  <p className="text-xs text-muted-foreground">
                                    {wrestler.weight_class || 'Weight not set'}
                                  </p>
                                </div>
                                {selectedWrestler2?.id === wrestler.id && (
                                  <CheckCircle className="h-5 w-5 text-levelup-primary" />
                                )}
                              </div>
                            </button>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-4 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleContinue}
                    disabled={!canContinue()}
                    className="flex-1"
                  >
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Select Date & Time */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Select Date & Time</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Calendar */}
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date()}
                    className="rounded-md border"
                  />
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Morning</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {TIME_SLOTS.morning.map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`p-3 border-2 rounded-lg transition-all ${
                            selectedTime === time
                              ? 'border-levelup-primary bg-levelup-primary text-white'
                              : 'border-border hover:border-levelup-primary/50'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>

                    <h3 className="font-semibold mt-6">Afternoon</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {TIME_SLOTS.afternoon.map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`p-3 border-2 rounded-lg transition-all ${
                            selectedTime === time
                              ? 'border-levelup-primary bg-levelup-primary text-white'
                              : 'border-border hover:border-levelup-primary/50'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>

                    <h3 className="font-semibold mt-6">Evening</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {TIME_SLOTS.evening.map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`p-3 border-2 rounded-lg transition-all ${
                            selectedTime === time
                              ? 'border-levelup-primary bg-levelup-primary text-white'
                              : 'border-border hover:border-levelup-primary/50'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(2)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handlePayment}
                    disabled={!canContinue()}
                    className="flex-1"
                  >
                    Continue to Payment
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Booking Summary Card */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Athlete Info */}
              <div className="flex items-center gap-3 pb-4 border-b">
                {athlete.photo_url ? (
                  <img
                    src={athlete.photo_url}
                    alt={`${athlete.first_name} ${athlete.last_name}`}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">
                    {athlete.first_name} {athlete.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{athlete.school}</p>
                </div>
              </div>

              {/* Youth Wrestler(s) */}
              <div>
                <p className="text-sm font-medium mb-2">Youth Wrestler(s)</p>
                {selectedWrestler ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {selectedWrestler.first_name} {selectedWrestler.last_name}
                      </span>
                    </div>
                    {selectedWrestler2 && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {selectedWrestler2.first_name} {selectedWrestler2.last_name}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not selected</p>
                )}
              </div>

              {/* Session Type */}
              <div>
                <p className="text-sm font-medium mb-2">Session Type</p>
                {sessionType ? (
                  <p className="text-sm">{sessionType}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Not selected</p>
                )}
              </div>

              {/* Date & Time */}
              <div>
                <p className="text-sm font-medium mb-2">Date & Time</p>
                {selectedDate && selectedTime ? (
                  <div className="space-y-1 text-sm">
                    <p>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
                    <p className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {selectedTime}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not selected</p>
                )}
              </div>

              {/* Facility */}
              {facility && (
                <div>
                  <p className="text-sm font-medium mb-2">Location</p>
                  <p className="text-sm">{facility.name}</p>
                  {facility.address && (
                    <p className="text-xs text-muted-foreground">{facility.address}</p>
                  )}
                </div>
              )}

              {/* Total Price */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Total</p>
                  <p className="text-2xl font-bold">
                    ${calculatePrice().toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

