import { createBrowserClient } from '@supabase/ssr';
import { getTenantConfig } from '@/config/tenants';

export function createClient(tenantSlug: string) {
  const config = getTenantConfig(tenantSlug);
  
  return createBrowserClient(
    config.supabaseUrl,
    config.supabaseAnonKey
  );
}





