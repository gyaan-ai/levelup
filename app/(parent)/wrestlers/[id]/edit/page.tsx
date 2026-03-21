'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
import { useAuth } from '@/lib/auth/use-auth';

const youthWrestlerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().optional(),
  school: z.string().optional(),
  graduationYear: z.union([z.string(), z.number()]).optional().transform((v) => (v === '' || v == null ? undefined : typeof v === 'string' ? parseInt(v, 10) : v)),
  weightClass: z.string().optional(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced', 'elite']).optional(),
  wrestlingExperience: z.string().optional(),
  goals: z.string().optional(),
  medicalNotes: z.string().optional(),
  phone: z
    .string()
    .min(1, 'Cell phone is required')
    .refine((v) => v.replace(/\D/g, '').length >= 10, 'Enter a valid 10-digit cell number'),
});

type YouthWrestlerFormValues = z.infer<typeof youthWrestlerSchema>;

export default function EditYouthWrestlerPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoFocusX, setPhotoFocusX] = useState(50);
  const [photoFocusY, setPhotoFocusY] = useState(50);
  const [deleting, setDeleting] = useState(false);

  const { userRole } = useAuth();

  const form = useForm<YouthWrestlerFormValues>({
    resolver: zodResolver(youthWrestlerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      school: '',
      graduationYear: undefined as number | undefined,
      weightClass: '',
      skillLevel: '' as any,
      wrestlingExperience: '',
      goals: '',
      medicalNotes: '',
      phone: '',
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
          graduationYear: youthWrestler.graduation_year ?? undefined,
          weightClass: youthWrestler.weight_class || '',
          skillLevel: youthWrestler.skill_level || '',
          wrestlingExperience: youthWrestler.wrestling_experience || '',
          goals: youthWrestler.goals || '',
          medicalNotes: youthWrestler.medical_notes || '',
          phone: youthWrestler.phone || '',
        });

        if (youthWrestler.photo_url) {
          setPhotoPreview(youthWrestler.photo_url);
        }
        const fx = youthWrestler.photo_focus_x;
        const fy = youthWrestler.photo_focus_y;
        if (typeof fx === 'number' && fx >= 0 && fx <= 100) setPhotoFocusX(fx);
        if (typeof fy === 'number' && fy >= 0 && fy <= 100) setPhotoFocusY(fy);
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

  const photoContainerRef = useRef<HTMLDivElement>(null);
  const photoImgRef = useRef<HTMLImageElement>(null);
  const handlePhotoPositionClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = photoContainerRef.current;
      const img = photoImgRef.current;
      if (!container || !img || !img.complete || !img.naturalWidth) return;
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const W = rect.width;
      const H = rect.height;
      const Iw = img.naturalWidth;
      const Ih = img.naturalHeight;
      const s = Math.max(W / Iw, H / Ih);
      const px = (cx - W / 2) / s + (photoFocusX / 100) * Iw;
      const py = (cy - H / 2) / s + (photoFocusY / 100) * Ih;
      const newX = Math.min(100, Math.max(0, (px / Iw) * 100));
      const newY = Math.min(100, Math.max(0, (py / Ih) * 100));
      setPhotoFocusX(Math.round(newX));
      setPhotoFocusY(Math.round(newY));
    },
    [photoFocusX, photoFocusY]
  );

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
          photoFocusX: photoFocusX,
          photoFocusY: photoFocusY,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update youth wrestler');
      }

      const redirectTo = searchParams.get('redirect');
      const safeRedirect =
        redirectTo &&
        redirectTo.startsWith('/') &&
        !redirectTo.startsWith('//') &&
        !redirectTo.includes(':');
      router.push(safeRedirect ? redirectTo : `/wrestlers/${id}`);
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
                {photoPreview && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Position photo</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Click on the photo to set the focal point so the face stays visible on your wrestler card.
                    </p>
                    <div
                      ref={photoContainerRef}
                      role="button"
                      tabIndex={0}
                      onClick={handlePhotoPositionClick}
                      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).click()}
                      className="relative w-full max-w-[280px] h-36 rounded-lg overflow-hidden border bg-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
                      aria-label="Click to set focal point"
                    >
                      <img
                        ref={photoImgRef}
                        src={photoPreview}
                        alt=""
                        className="w-full h-full object-cover pointer-events-none"
                        style={{ objectPosition: `${photoFocusX}% ${photoFocusY}%` }}
                        draggable={false}
                      />
                    </div>
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Athlete cell phone *</FormLabel>
                    <FormControl>
                      <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="10-digit cell" {...field} />
                    </FormControl>
                    <FormDescription>
                      Required for coaches to text session updates to this athlete.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              {/* School and Graduation year */}
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
                  name="graduationYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Graduation year</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === '' ? undefined : parseInt(v, 10))}
                        value={field.value != null ? String(field.value) : ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Class of …" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 16 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                            <SelectItem key={year} value={String(year)}>
                              Class of {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Won&apos;t need yearly updates</FormDescription>
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

              {userRole === 'admin' && (
                <div className="mt-8 pt-6 border-t">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Admin</p>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={submitting || deleting}
                    onClick={async () => {
                      if (!window.confirm('Permanently delete this youth wrestler profile? This cannot be undone.')) return;
                      setDeleting(true);
                      try {
                        const res = await fetch(`/api/youth-wrestlers/${id}`, { method: 'DELETE' });
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          setError(data?.error ?? 'Failed to delete');
                          setDeleting(false);
                          return;
                        }
                        router.push('/admin');
                      } catch {
                        setError('Failed to delete');
                        setDeleting(false);
                      }
                    }}
                  >
                    {deleting ? 'Deleting...' : 'Delete youth wrestler'}
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

