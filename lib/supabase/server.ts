import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getTenantConfig } from '@/config/tenants';

export async function createClient(tenantSlug: string) {
  const config = getTenantConfig(tenantSlug);
  const cookieStore = await cookies();
  
  return createServerClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

