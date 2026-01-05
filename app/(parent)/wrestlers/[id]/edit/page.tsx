'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const youthWrestlerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().optional(),
  school: z.string().optional(),
  grade: z.string().optional(),
  weightClass: z.string().optional(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced', 'elite']).optional(),
  wrestlingExperience: z.string().optional(),
  goals: z.string().optional(),
  medicalNotes: z.string().optional(),
});

type YouthWrestlerFormValues = z.infer<typeof youthWrestlerSchema>;

export default function EditYouthWrestlerPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const form = useForm<YouthWrestlerFormValues>({
    resolver: zodResolver(youthWrestlerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      school: '',
      grade: '',
      weightClass: '',
      skillLevel: undefined,
      wrestlingExperience: '',
      goals: '',
      medicalNotes: '',
    },
  });

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/api/youth-wrestlers/${id}`);
        if (!response.ok) {
          throw new Error('Failed to load youth wrestler');
        }

        const { youthWrestler } = await response.json();

        // Format date for input
        const dateOfBirth = youthWrestler.date_of_birth
          ? new Date(youthWrestler.date_of_birth).toISOString().split('T')[0]
          : '';

        form.reset({
          firstName: youthWrestler.first_name || '',
          lastName: youthWrestler.last_name || '',
          dateOfBirth: dateOfBirth,
          school: youthWrestler.school || '',
          grade: youthWrestler.grade || '',
          weightClass: youthWrestler.weight_class || '',
          skillLevel: youthWrestler.skill_level || undefined,
          wrestlingExperience: youthWrestler.wrestling_experience || '',
          goals: youthWrestler.goals || '',
          medicalNotes: youthWrestler.medical_notes || '',
        });

        if (youthWrestler.photo_url) {
          setPhotoPreview(youthWrestler.photo_url);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load youth wrestler');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadData();
    }
  }, [id, form]);

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

  const onSubmit = async (values: YouthWrestlerFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      let photoUrl = photoPreview;

      // Upload photo if new file selected
      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        formData.append('youthWrestlerId', id);

        const uploadResponse = await fetch('/api/youth-wrestlers/upload-photo', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          photoUrl = uploadData.photoUrl;
        }
      }

      // Update youth wrestler
      const response = await fetch(`/api/youth-wrestlers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          photoUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update youth wrestler');
      }

      router.push(`/wrestlers/${id}`);
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
      <Link href={`/wrestlers/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Profile
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Edit Youth Wrestler</CardTitle>
          <CardDescription>
            Update your youth wrestler&apos;s profile
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
              <div>
                <label className="text-sm font-medium mb-2 block">Profile Photo</label>
                <div className="flex items-center gap-4">
                  {photoPreview && (
                    <img
                      src={photoPreview}
                      alt="Preview"
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload a new photo (max 5MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Date of Birth */}
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      Age will be calculated automatically
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* School and Grade */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School</FormLabel>
                      <FormControl>
                        <Input placeholder="Elementary School" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grade</FormLabel>
                      <FormControl>
                        <Input placeholder="5th" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Weight Class and Skill Level */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="weightClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight Class</FormLabel>
                      <FormControl>
                        <Input placeholder="75 lbs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="skillLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skill Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select skill level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                          <SelectItem value="elite">Elite</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Wrestling Experience */}
              <FormField
                control={form.control}
                name="wrestlingExperience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wrestling Experience</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 3 years, first year, etc."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Goals */}
              <FormField
                control={form.control}
                name="goals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goals</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What do you want to work on?"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Medical Notes */}
              <FormField
                control={form.control}
                name="medicalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any injuries, allergies, or health information?"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/wrestlers/${id}`)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

