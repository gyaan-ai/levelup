'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/lib/auth/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, X, ArrowLeft, Globe, Lock } from 'lucide-react';
import Link from 'next/link';

const profileSchema = z.object({
  weightClass: z.string().optional(),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
  credentials: z.array(z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
  })).optional(),
  facilityId: z.string().optional(),
  venmoHandle: z.string().max(30).optional(),
  zelleEmail: z.union([z.string().email('Use a valid email for Zelle'), z.literal('')]).optional(),
  photo: z.instanceof(File).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string; school: string }>>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const visibilityModalRef = useRef<HTMLDialogElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      weightClass: '',
      bio: '',
      credentials: [],
      facilityId: '',
      venmoHandle: '',
      zelleEmail: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'credentials',
  });

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/athletes/profile');
        const data = await response.json();

        if (data.athlete) {
          form.reset({
            weightClass: data.athlete.weight_class || '',
            bio: data.athlete.bio || '',
            credentials: (data.athlete.credentials && Object.keys(data.athlete.credentials).length > 0)
              ? Object.entries(data.athlete.credentials).map(([title, desc]: [string, any]) => ({
                  title,
                  description: desc || '',
                }))
              : [],
            facilityId: data.athlete.facility_id || '',
            venmoHandle: data.athlete.venmo_handle || '',
            zelleEmail: data.athlete.zelle_email || '',
          });

          if (data.athlete.photo_url) {
            setPhotoPreview(data.athlete.photo_url);
          }

          setIsPublic(data.athlete.active === true);
        }

        setFacilities(data.facilities || []);
      } catch (err) {
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadData();
    }
  }, [user, form]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const doSave = async (makePublic: boolean) => {
    setSubmitting(true);
    setError(null);
    setSaveSuccess(null);

    try {
      const values = form.getValues();
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

      const credentialsObj: Record<string, string> = {};
      (values.credentials || []).forEach((cred) => {
        if (cred.title) {
          credentialsObj[cred.title] = cred.description || '';
        }
      });

      const response = await fetch('/api/athletes/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weightClass: values.weightClass,
          bio: values.bio,
          credentials: credentialsObj,
          photoUrl,
          facilityId: values.facilityId,
          venmoHandle: values.venmoHandle?.trim() || undefined,
          zelleEmail: values.zelleEmail?.trim() || undefined,
          active: makePublic,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      visibilityModalRef.current?.close();

      if (makePublic) {
        setIsPublic(true);
        router.push('/athlete-dashboard');
        router.refresh();
      } else {
        setIsPublic(false);
        setSaveSuccess('Profile saved. It stays private—you can keep editing.');
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setSubmitting(false);
    }
  };

  const onSubmit = () => {
    setError(null);
    setSaveSuccess(null);
    visibilityModalRef.current?.showModal();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/athlete-dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
          <CardDescription>
            Update your profile information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {saveSuccess && (
            <div className="mb-4 p-3 bg-accent/10 border border-accent rounded-md">
              <p className="text-sm text-foreground">{saveSuccess}</p>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Photo Upload */}
              <FormField
                control={form.control}
                name="photo"
                render={() => (
                  <FormItem>
                    <FormLabel>Profile Photo</FormLabel>
                    <div className="flex items-center gap-4">
                      {photoPreview && (
                        <img
                          src={photoPreview}
                          alt="Profile preview"
                          className="w-24 h-24 rounded-full object-cover border"
                        />
                      )}
                      <div>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="cursor-pointer"
                        />
                        <FormDescription>
                          Upload a professional photo (max 5MB)
                        </FormDescription>
                      </div>
                    </div>
                  </FormItem>
                )}
              />

              {/* Weight Class */}
              <FormField
                control={form.control}
                name="weightClass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight Class</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 157 lbs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Bio */}
              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell parents about your wrestling experience, achievements, and coaching style..."
                        maxLength={500}
                        rows={5}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value?.length || 0}/500 characters
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Profile visibility: Public (bookable) vs Private (hidden, keep editing) */}
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Profile visibility</label>
                <p className="text-sm text-muted-foreground mb-2">
                  Public profiles appear in Browse and can receive bookings. Private profiles are hidden while you edit.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={isPublic ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={async () => {
                      if (isPublic) return;
                      try {
                        const r = await fetch('/api/athletes/profile/visibility', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ active: true }),
                        });
                        if (r.ok) setIsPublic(true);
                      } catch {
                        setError('Failed to update visibility');
                      }
                    }}
                  >
                    <Globe className="h-4 w-4 mr-1.5" />
                    Public
                  </Button>
                  <Button
                    type="button"
                    variant={!isPublic ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={async () => {
                      if (!isPublic) return;
                      try {
                        const r = await fetch('/api/athletes/profile/visibility', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ active: false }),
                        });
                        if (r.ok) setIsPublic(false);
                      } catch {
                        setError('Failed to update visibility');
                      }
                    }}
                  >
                    <Lock className="h-4 w-4 mr-1.5" />
                    Private
                  </Button>
                </div>
              </div>

              {/* Facility Selection */}
              {facilities.length > 0 && (
                <FormField
                  control={form.control}
                  name="facilityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Facility</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a facility" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {facilities.map((facility) => (
                            <SelectItem key={facility.id} value={facility.id}>
                              {facility.name} - {facility.school}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Payout: Venmo / Zelle */}
              <div className="space-y-4 rounded-lg border p-4">
                <p className="text-sm font-medium text-primary">How you get paid</p>
                <p className="text-sm text-muted-foreground">
                  We pay coaches via Venmo or Zelle. Add at least one so we can send your earnings.
                </p>
                <FormField
                  control={form.control}
                  name="venmoHandle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venmo username</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. jake-miller" {...field} />
                      </FormControl>
                      <FormDescription>Your Venmo handle (without @)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zelleEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zelle (email or phone)</FormLabel>
                      <FormControl>
                        <Input placeholder="email@example.com or 5551234567" {...field} />
                      </FormControl>
                      <FormDescription>Email or phone linked to your Zelle account</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Credentials */}
              <div>
                <FormLabel className="mb-2 block">Credentials & Achievements</FormLabel>
                <FormDescription className="mb-4">
                  Add your wrestling achievements, awards, and credentials
                </FormDescription>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 mb-2">
                    <FormField
                      control={form.control}
                      name={`credentials.${index}.title`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Title (e.g., NCAA Qualifier)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`credentials.${index}.description`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Description (optional)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ title: '', description: '' })}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Credential
                </Button>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/athlete-dashboard')}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <dialog
        ref={visibilityModalRef}
        className="rounded-lg border bg-background p-6 shadow-lg max-w-md w-[calc(100%-2rem)]"
      >
        <h3 className="font-semibold text-lg mb-2">Save profile</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Would you like to make your profile public and ready for bookings, or keep it private to continue editing?
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            className="flex-1"
            onClick={() => doSave(true)}
            disabled={submitting}
          >
            <Globe className="h-4 w-4 mr-2" />
            Make Public
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => doSave(false)}
            disabled={submitting}
          >
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
    </div>
  );
}

