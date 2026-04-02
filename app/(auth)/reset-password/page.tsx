'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from '@/components/theme-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const schema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirm: z.string().min(6, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type ResetValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenant = useTenant();
  const [initError, setInitError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ResetValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  useEffect(() => {
    let cancelled = false;
    const client = createClient(tenant.slug);
    async function init() {
      const code = searchParams.get('code');
      try {
        if (code) {
          const { error: exchangeErr } = await client.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            if (!cancelled) setInitError(exchangeErr.message || 'Invalid or expired link');
            if (!cancelled) setReady(true);
            return;
          }
        }
        const {
          data: { session },
        } = await client.auth.getSession();
        if (!cancelled) {
          if (session?.user) {
            setSessionOk(true);
          } else {
            setInitError(
              'This reset link is invalid or expired. Request a new one from the sign-in page.'
            );
          }
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setInitError('Could not verify reset link.');
          setReady(true);
        }
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [tenant.slug, searchParams]);

  const onSubmit = async (values: ResetValues) => {
    setLoading(true);
    setError(null);
    try {
      const client = createClient(tenant.slug);
      const { error: updateErr } = await client.auth.updateUser({ password: values.password });
      if (updateErr) {
        setError(updateErr.message || 'Could not update password');
        setLoading(false);
        return;
      }
      router.push('/login?message=password_reset');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground text-sm">Verifying link…</p>
      </div>
    );
  }

  if (initError || !sessionOk) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-foreground font-serif">Link invalid</CardTitle>
            <CardDescription>{initError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <Link href="/forgot-password">Request a new reset link</Link>
            </Button>
            <div className="mt-4 text-center text-sm">
              <Link href="/login" className="text-accent hover:underline">
                Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-foreground font-serif">Choose a new password</CardTitle>
          <CardDescription>
            Enter a new password for your Guild account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-accent dark-input-fill"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-accent dark-input-fill"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Saving…' : 'Update password'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
