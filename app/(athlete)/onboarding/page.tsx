'use client';

import { useState, useEffect } from 'react';
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
import { Plus, X, Upload } from 'lucide-react';

const onboardingSchema = z.object({
  weightClass: z.string().optional(),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
  credentials: z.array(z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
  })).optional(),
  facilityId: z.string().optional(),
  photo: z.instanceof(File).optional(),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string; school: string }>>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      weightClass: '',
      bio: '',
      credentials: [],
      facilityId: '',
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
          // Pre-fill form if profile exists
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
          });

          if (data.athlete.photo_url) {
            setPhotoPreview(data.athlete.photo_url);
          }
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

  const onSubmit = async (values: OnboardingFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      let photoUrl = photoPreview;

      // Upload photo if new file selected
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

      // Convert credentials array to object
      const credentialsObj: Record<string, string> = {};
      (values.credentials || []).forEach((cred) => {
        if (cred.title) {
          credentialsObj[cred.title] = cred.description || '';
        }
      });

      // Update profile
      const response = await fetch('/api/athletes/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          weightClass: values.weightClass,
          bio: values.bio,
          credentials: credentialsObj,
          photoUrl,
          facilityId: values.facilityId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Redirect to dashboard
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setSubmitting(false);
    }
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
      <Card>
        <CardHeader>
          <CardTitle>Complete Your Profile</CardTitle>
          <CardDescription>
            Add your information to start receiving booking requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive">{error}</p>
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
                  {submitting ? 'Saving...' : 'Complete Profile'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  disabled={submitting}
                >
                  Skip for Now
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

