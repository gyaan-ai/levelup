import { loadStripe } from '@stripe/stripe-js';
import { getTenantConfig } from '@/config/tenants';

export async function getStripeClient(tenantSlug: string) {
  const config = getTenantConfig(tenantSlug);
  return loadStripe(config.stripePublishableKey);
}





