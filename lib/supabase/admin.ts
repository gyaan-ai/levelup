import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getTenantConfig } from '@/config/tenants';

function resolveServiceKey(tenantSlug: string): string | undefined {
  return (
    process.env[`${tenantSlug.toUpperCase().replace(/-/g, '_')}_SUPABASE_SERVICE_KEY`] ||
    process.env.GUILD_SUPABASE_SERVICE_KEY ||
    process.env.NC_UNITED_SUPABASE_SERVICE_KEY
  );
}

/**
 * Same as createAdminClient but returns null when the service role key is not configured
 * (e.g. Vercel preview without env). Use for public pages that can degrade without admin data.
 */
export function createAdminClientIfAvailable(tenantSlug: string): SupabaseClient | null {
  const config = getTenantConfig(tenantSlug);
  const serviceKey = resolveServiceKey(tenantSlug);
  if (!serviceKey) {
    return null;
  }
  return createClient(config.supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function createAdminClient(tenantSlug: string) {
  const config = getTenantConfig(tenantSlug);
  const serviceKey = resolveServiceKey(tenantSlug);

  if (!serviceKey) {
    throw new Error(`Service key not found for tenant: ${tenantSlug}`);
  }

  return createClient(config.supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}





