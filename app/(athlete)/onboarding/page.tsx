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
import { Camera, Globe, Lock } from 'lucide-react';

const onboardingSchema = z.object({
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
  facilityId: z.string().optional(),
  venmoHandle: z.string().max(30).optional(),
  zelleEmail: z.union([z.string().email('Use a valid email for Zelle'), z.literal('')]).optional(),
  photo: z.instanceof(File).optional(),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

const TOTAL_STEPS = 4;

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
        const data = await response.json();

        if (data.athlete) {
          form.reset({
            bio: data.athlete.bio || '',
            facilityId: data.athlete.facility_id || '',
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
      if (!uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        throw new Error(uploadData.error || 'Failed to upload photo');
      }
      const uploadData = await uploadResponse.json();
      photoUrl = uploadData.photoUrl;
    }

    const response = await fetch('/api/athletes/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio: values.bio,
        photoUrl,
        facilityId: values.facilityId,
        venmoHandle: values.venmoHandle?.trim() || undefined,
        zelleEmail: values.zelleEmail?.trim() || undefined,
        active,
      }),
    });

    const data = await response.json();
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
      if (!values.bio?.trim()) {
        setError('Please add a bio so parents can learn about you.');
        return;
      }
      setSubmitting(true);
      try {
        await savePartial(values, false);
        setStep(2);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (step === 2 && facilities.length > 0) {
      if (!values.facilityId) {
        setError('Please select a training facility.');
        return;
      }
    }

    if (step === 3) {
      const hasVenmo = values.venmoHandle?.trim();
      const hasZelle = values.zelleEmail?.trim();
      if (!hasVenmo && !hasZelle) {
        setError('Add at least one payout method (Venmo or Zelle) so we can pay you.');
        return;
      }
      if (values.zelleEmail?.trim() && !values.zelleEmail.includes('@') && !/^\d{10}$/.test(values.zelleEmail.replace(/\D/g, ''))) {
        setError('Enter a valid Zelle email or 10-digit phone number.');
        return;
      }
      setSubmitting(true);
      try {
        await savePartial(values, false);
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
    else if (step === 2 && facilities.length > 0) setStep(3);
    else if (step === 3) setError('Add Venmo or Zelle to receive payments.');
  };

  const canGoNext = (() => {
    if (step === 1) return !!form.watch('bio')?.trim();
    if (step === 2 && facilities.length > 0) return !!form.watch('facilityId');
    if (step === 3) {
      const v = form.watch();
      return !!(v.venmoHandle?.trim() || v.zelleEmail?.trim());
    }
    return true;
  })();

  const showSkip = step === 0 || (step === 2 && facilities.length > 0);

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
        nextLabel={step === TOTAL_STEPS - 1 ? 'Finish' : 'Continue'}
        showSkip={showSkip}
        skipLabel="Skip for now"
        wizardTitle="Coach profile"
        wizardDescription="A few steps to get you set up"
      >
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-accent/10 border-2 border-accent rounded-md">
            <p className="font-semibold text-primary">Welcome to The Guild!</p>
            <p className="text-sm text-muted-foreground mt-1">{successMessage}</p>
          </div>
        )}

        <Form {...form}>
          {/* Step 0: Photo */}
          {step === 0 && (
            <Card className="border-0 shadow-none">
              <CardContent className="p-0">
                <p className="text-muted-foreground mb-4">
                  Add a photo so parents recognize you.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <label className="relative cursor-pointer group">
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

          {/* Step 1: Bio */}
          {step === 1 && (
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

          {/* Step 2: Facility */}
          {step === 2 && (
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a facility" />
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
                  </>
                ) : (
                  <p className="text-muted-foreground">No facilities set up yet. Add one in your profile later.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Payout */}
          {step === 3 && (
            <Card className="border-0 shadow-none">
              <CardContent className="p-0 space-y-4">
                <p className="text-muted-foreground">
                  How should we pay you? Add Venmo or Zelle.
                </p>
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
                        <Input placeholder="email@example.com or 5551234567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="text-sm text-muted-foreground pt-2">Almost done. Choose whether to go live next.</p>
              </CardContent>
            </Card>
          )}
        </Form>
      </OnboardingWizard>

      <dialog ref={visibilityModalRef} className="rounded-lg border bg-background p-6 shadow-lg max-w-md w-[calc(100%-2rem)]">
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
