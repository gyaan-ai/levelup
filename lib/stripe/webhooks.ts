import Stripe from 'stripe';
import { getTenantConfig } from '@/config/tenants';

export function getStripeInstance(tenantSlug: string): Stripe {
  const config = getTenantConfig(tenantSlug);
  const secretKey = process.env[`${tenantSlug.toUpperCase().replace('-', '_')}_STRIPE_SECRET_KEY`] ||
                    process.env.NC_UNITED_STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error(`Stripe secret key not found for tenant: ${tenantSlug}`);
  }
  
  return new Stripe(secretKey, {
    apiVersion: '2023-10-16',
  });
}

export function getWebhookSecret(tenantSlug: string): string {
  const webhookSecret = process.env[`${tenantSlug.toUpperCase().replace('-', '_')}_STRIPE_WEBHOOK_SECRET`] ||
                        process.env.NC_UNITED_STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error(`Stripe webhook secret not found for tenant: ${tenantSlug}`);
  }
  
  return webhookSecret;
}

