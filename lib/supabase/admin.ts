import { createClient } from '@supabase/supabase-js';
import { getTenantConfig } from '@/config/tenants';

export function createAdminClient(tenantSlug: string) {
  const config = getTenantConfig(tenantSlug);
  const serviceKey = process.env[`${tenantSlug.toUpperCase().replace('-', '_')}_SUPABASE_SERVICE_KEY`] || 
                     process.env.NC_UNITED_SUPABASE_SERVICE_KEY;
  
  if (!serviceKey) {
    throw new Error(`Service key not found for tenant: ${tenantSlug}`);
  }
  
  return createClient(
    config.supabaseUrl,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

