'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { ArrowLeft, Upload } from 'lucide-react';
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

export default function AddYouthWrestlerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
      skillLevel: '' as any,
      wrestlingExperience: '',
      goals: '',
      medicalNotes: '',
    },
  });

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
    setLoading(true);
    setError(null);

    try {
      // Create wrestler first (without photo)
      const createResponse = await fetch('/api/youth-wrestlers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!createResponse.ok) {
        const data = await createResponse.json();
        throw new Error(data.error || 'Failed to create youth wrestler');
      }

      const { youthWrestler } = await createResponse.json();

      // Upload photo if provided
      if (photoFile) {
        const formData = new FormData();
        formData.append('file', photoFile);
        formData.append('youthWrestlerId', youthWrestler.id);

        const uploadResponse = await fetch('/api/youth-wrestlers/upload-photo', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          
          // Update wrestler with photo URL
          await fetch(`/api/youth-wrestlers/${youthWrestler.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...values,
              photoUrl: uploadData.photoUrl,
            }),
          });
        }
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Add Youth Wrestler</CardTitle>
          <CardDescription>
            Create a profile for your youth wrestler
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
                <label className="text-sm font-medium mb-2 block">Profile Photo (Optional)</label>
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
                      Upload a photo (max 5MB)
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
                      <Select onValueChange={field.onChange} value={field.value || ''}>
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
                        placeholder="What do you want to work on? (e.g., takedowns, escapes, conditioning)"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Help the athlete understand what to focus on during sessions
                    </FormDescription>
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
                        placeholder="Any injuries, allergies, or health information we should know?"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This information will be shared with athletes for safety
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Profile'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  disabled={loading}
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

