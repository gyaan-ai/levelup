/**
 * When true, booking flows charge $0.50 via Stripe and store penny amounts on the session
 * (see bookings API). Only honored in development so preview/production deploys are never
 * accidentally left on penny pricing if TEST_MODE_PENNY_PRICING is still set.
 */
export function isPennyTestPricingEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    process.env.TEST_MODE_PENNY_PRICING === 'true'
  );
}
