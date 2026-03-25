'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/lib/auth/use-auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OnboardingWizard } from '@/components/onboarding-wizard';
import { AthleteProductSelection } from '@/components/athlete-product-selection';
import { RequestFacilityBlock } from '@/components/request-facility-block';
import { Camera, Globe, Lock } from 'lucide-react';

const onboardingSchema = z.object({
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
  facilityId: z.string().optional(),
  secondaryFacilityId: z.string().optional(),
  phone: z.string().min(1, 'Cell phone is required').refine((v) => v.replace(/\D/g, '').length >= 10, 'Enter a valid 10-digit cell number'),
  venmoHandle: z.string().max(30).optional(),
  zelleEmail: z.string().optional().refine((v) => !v || v.trim() === '' || (v.includes('@') ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) : v.replace(/\D/g, '').length >= 7), 'Use a valid email or phone (7+ digits) for Zelle'),
  photo: z.instanceof(File).optional(),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

const TOTAL_STEPS = 6;

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string; school: string }>>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const visibilityModalRef = useRef<HTMLDialogElement>(null);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      bio: '',
      facilityId: '',
      secondaryFacilityId: '',
      phone: '',
      venmoHandle: '',
      zelleEmail: '',
    },
  });

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/athletes/profile?' + new Date().getTime(), {
          cache: 'no-store',
        });
        const contentType = response.headers.get('content-type') ?? '';
        let data: { athlete?: any; facilities?: any[] } = {};
        if (contentType.includes('application/json')) {
          try {
            data = await response.json();
          } catch {
            setError('Failed to load profile data');
            return;
          }
        }

        if (data.athlete) {
          form.reset({
            bio: data.athlete.bio || '',
            facilityId: data.athlete.facility_id || '',
            secondaryFacilityId: data.athlete.secondary_facility_id || '',
            phone: data.athlete.phone || '',
            venmoHandle: data.athlete.venmo_handle || '',
            zelleEmail: data.athlete.zelle_email || '',
          });
          if (data.athlete.photo_url) setPhotoPreview(data.athlete.photo_url);
        }
        setFacilities(data.facilities || []);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    }
    if (user) loadData();
  }, [user, form]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const savePartial = async (values: OnboardingFormValues, active: boolean) => {
    let photoUrl = photoPreview;
    if (photoFile) {
      const formData = new FormData();
      formData.append('file', photoFile);
      const uploadResponse = await fetch('/api/athletes/upload-photo', {
        method: 'POST',
        body: formData,
      });
      const uploadCt = uploadResponse.headers.get('content-type') ?? '';
      let uploadData: { error?: string; photoUrl?: string } = {};
      if (uploadCt.includes('application/json')) {
        try {
          uploadData = await uploadResponse.json();
        } catch {
          throw new Error('Invalid response from server. Please try again.');
        }
      }
      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || 'Failed to upload photo');
      }
      if (uploadData.photoUrl) photoUrl = uploadData.photoUrl;
    }

    const response = await fetch('/api/athletes/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio: values.bio,
        photoUrl,
        facilityId: values.facilityId,
        secondaryFacilityId: values.secondaryFacilityId || undefined,
        phone: values.phone?.trim() || undefined,
        venmoHandle: values.venmoHandle?.trim() || undefined,
        zelleEmail: values.zelleEmail?.trim() || undefined,
        active,
      }),
    });

    const contentType = response.headers.get('content-type') ?? '';
    let data: { error?: string; success?: boolean } = {};
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        throw new Error('Invalid response from server. Please try again.');
      }
    }
    if (!response.ok) throw new Error(data.error || 'Failed to update profile');
    if (!data.success) throw new Error('Profile save did not confirm success');
  };

  const doSave = async (makePublic: boolean) => {
    setSubmitting(true);
    setError(null);
    try {
      const values = form.getValues();
      await savePartial(values, makePublic);
      visibilityModalRef.current?.close();
      setSuccess(true);
      setSubmitting(false);
      if (makePublic) {
        setSuccessMessage('Your profile is live. Redirecting to dashboard...');
        setTimeout(() => { window.location.href = '/athlete-dashboard'; }, 2000);
      } else {
        setSuccessMessage('Profile saved. You can keep editing or go to dashboard.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    setError(null);
    const values = form.getValues();

    if (step === 0) {
      setStep(1);
      return;
    }

    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!values.bio?.trim()) {
        setError('Please add a bio so parents can learn about you.');
        return;
      }
      setSubmitting(true);
      try {
        await savePartial(values, false);
        setStep(3);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (step === 3 && facilities.length > 0) {
      if (!values.facilityId) {
        setError('Please select a training facility.');
        return;
      }
    }

    if (step === 4) {
      const digits = values.phone?.replace(/\D/g, '') ?? '';
      if (digits.length < 10) {
        setError('Enter your cell number (10 digits) so we can text you when someone signs up.');
        return;
      }
      const hasVenmo = values.venmoHandle?.trim();
      const hasZelle = values.zelleEmail?.trim();
      if (!hasVenmo && !hasZelle) {
        setError('Add at least one payout method (Venmo or Zelle) so we can pay you.');
        return;
      }
      if (values.zelleEmail?.trim() && !values.zelleEmail.includes('@') && values.zelleEmail.replace(/\D/g, '').length < 7) {
        setError('Enter a valid Zelle email or phone (7+ digits).');
        return;
      }
      setSubmitting(true);
      try {
        await savePartial(values, false);
        setStep(5);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (step === 5) {
      setSubmitting(true);
      try {
        await savePartial(form.getValues(), false);
        visibilityModalRef.current?.showModal();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSkip = () => {
    if (step === 0) setStep(1);
    else if (step === 1) setStep(2);
    else if (step === 3 && facilities.length > 0) setStep(4);
    else if (step === 4) setError('Add your cell number and Venmo or Zelle to continue.');
    else if (step === 5) {
      visibilityModalRef.current?.showModal();
    }
  };

  const canGoNext = (() => {
    if (step === 2) return !!form.watch('bio')?.trim();
    if (step === 3 && facilities.length > 0) return !!form.watch('facilityId');
    if (step === 4) {
      const v = form.watch();
      const phoneDigits = (v.phone ?? '').replace(/\D/g, '');
      return phoneDigits.length >= 10 && !!(v.venmoHandle?.trim() || v.zelleEmail?.trim());
    }
    return true;
  })();

  const showSkip = step === 0 || step === 1 || (step === 3 && facilities.length > 0) || step === 5;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <OnboardingWizard
        currentStep={step}
        totalSteps={TOTAL_STEPS}
        onNext={handleNext}
        onBack={handleBack}
        onSkip={handleSkip}
        canGoNext={canGoNext}
        isLoading={submitting}
        nextLabel={step === 5 ? 'Finish' : 'Continue'}
        showSkip={showSkip}
        skipLabel="Skip for now"
        wizardTitle="Coach profile"
        wizardDescription="A few steps to get you set up"
        exitHref="/"
        exitLabel="Exit setup"
      >
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-accent/10 border-2 border-accent rounded-md">
            <p className="font-semibold text-foreground">Welcome to The Guild!</p>
            <p className="text-sm text-muted-foreground mt-1">{successMessage}</p>
          </div>
        )}

        <Form {...form}>
          {/* Step 0: Earnings preview */}
          {step === 0 && (
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <p className="text-muted-foreground mb-4">
                  Here’s what you earn per session. You earn more when you teach groups.
                </p>
                <ul className="space-y-3 text-foreground">
                  <li className="flex justify-between items-baseline gap-4">
                    <span>Private session</span>
                    <span className="font-semibold">$50</span>
                  </li>
                  <li className="flex justify-between items-baseline gap-4">
                    <span>Partner session (2 athletes)</span>
                    <span className="font-semibold">$75</span>
                  </li>
                  <li className="flex justify-between items-baseline gap-4">
                    <span>Small group (up to 6)</span>
                    <span className="font-semibold">Up to $150</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Photo */}
          {step === 1 && (
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <p className="text-muted-foreground mb-4">
                  Add a photo so parents recognize you.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <label className="relative cursor-pointer group touch-manipulation min-w-[44px] min-h-[44px]">
                    <div className="w-32 h-32 rounded-full border-4 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden group-hover:border-accent/50 transition-colors bg-muted/30">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="absolute inset-0 w-full h-full opacity-0"
                    />
                  </label>
                  <div className="text-center sm:text-left">
                    <p className="text-sm font-medium mb-1">Profile Photo</p>
                    <p className="text-xs text-muted-foreground">Tap to upload (max 5MB)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Bio */}
          {step === 2 && (
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <p className="text-muted-foreground mb-4">
                  Tell parents about your background. What makes you a great coach?
                </p>
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., NCAA qualifier, 3x state champ. I focus on technique fundamentals and conditioning..."
                          maxLength={500}
                          rows={5}
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{field.value?.length || 0}/500</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 3: Facility */}
          {step === 3 && (
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                {facilities.length > 0 ? (
                  <>
                    <p className="text-muted-foreground mb-4">
                      Where will you train?
                    </p>
                    <FormField
                      control={form.control}
                      name="facilityId"
                      render={({ field }) => (
                        <FormItem>
                          <Select
                            onValueChange={(val) => {
                              field.onChange(val);
                              if (form.getValues('secondaryFacilityId') === val) form.setValue('secondaryFacilityId', '');
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Primary facility" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {facilities.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.name} – {f.school}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="secondaryFacilityId"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <Select onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)} value={field.value || '__none__'}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Secondary facility (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {facilities
                                .filter((f) => f.id !== form.watch('facilityId'))
                                .map((f) => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.name} – {f.school}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <RequestFacilityBlock className="mt-4" />
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground mb-4">No facilities set up yet. Request one and we&apos;ll add it after review.</p>
                    <RequestFacilityBlock />
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 4: Cell phone + Payout */}
          {step === 4 && (
            <Card className="border-0 shadow-none">
              <CardContent className="p-0 space-y-4">
                <p className="text-muted-foreground">
                  We need your cell number to text you when someone signs up for a session. Then add how we should pay you.
                </p>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cell phone</FormLabel>
                      <FormControl>
                        <Input placeholder="5551234567" inputMode="tel" autoComplete="tel" {...field} />
                      </FormControl>
                      <FormDescription>We&apos;ll text when someone books your session.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="venmoHandle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venmo</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. jake-miller" {...field} />
                      </FormControl>
                      <FormDescription>Handle without @</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zelleEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zelle</FormLabel>
                      <FormControl>
                        <Input placeholder="email@example.com or 5551234567" inputMode="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="text-sm text-muted-foreground pt-2">You can add or change payout details anytime in your profile.</p>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Rate card / Session types */}
          {step === 5 && (
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <p className="text-muted-foreground mb-4">
                  Choose which session types you offer and at what price. You can edit this anytime in your profile.
                </p>
                <AthleteProductSelection />
              </CardContent>
            </Card>
          )}
        </Form>
      </OnboardingWizard>

      <dialog ref={visibilityModalRef} className="rounded-lg border bg-background p-6 shadow-lg max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-lg mb-2">Go live?</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Public = parents can book you. Private = keep editing.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button type="button" className="flex-1" onClick={() => doSave(true)} disabled={submitting}>
            <Globe className="h-4 w-4 mr-2" />
            Make Public
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => doSave(false)} disabled={submitting}>
            <Lock className="h-4 w-4 mr-2" />
            Keep Private
          </Button>
        </div>
        <form method="dialog" className="mt-3">
          <Button type="submit" variant="ghost" size="sm">
            Cancel
          </Button>
        </form>
      </dialog>
    </>
  );
}
