# Stripe Implementation Plan (Test Mode)

Use **Stripe test mode** for all development and QA. No real charges; use test card `4242 4242 4242 4242`.

---

## Enable Stripe in 4 steps

1. **Env vars** (in `.env.local` and in Vercel):
   - `NEXT_PUBLIC_NC_UNITED_STRIPE_KEY` = your Stripe **publishable** key (`pk_test_...`)
   - `NC_UNITED_STRIPE_SECRET_KEY` = your Stripe **secret** key (`sk_test_...`)
   - `NC_UNITED_STRIPE_WEBHOOK_SECRET` = webhook signing secret (`whsec_...`) — see step 3
   - `STRIPE_CHECKOUT_ENABLED=true` to turn on payment at checkout
   - Optional: `NEXT_PUBLIC_APP_URL=https://your-app.vercel.app` so Stripe redirects work in production

2. **Stripe Dashboard (test mode):** Developers → API keys. Copy publishable and secret into env.

3. **Webhook:** Stripe Dashboard → Developers → Webhooks → Add endpoint:
   - **URL:** `https://your-domain.com/api/stripe/webhook` (e.g. `https://your-app.vercel.app/api/stripe/webhook`)
   - **Events:** `checkout.session.completed`
   - Copy the **Signing secret** → set as `NC_UNITED_STRIPE_WEBHOOK_SECRET`

4. **Redeploy** (or restart dev server). When a parent clicks "Pay and Book", they are redirected to Stripe Checkout; after payment, Stripe redirects back to the confirmed page and the webhook sets the session to `scheduled`.

**Local testing:** For localhost, use [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:3000/api/stripe/webhook` and use the CLI-printed `whsec_...` as `NC_UNITED_STRIPE_WEBHOOK_SECRET`.

---

## Stripe off by default

Booking works **without Stripe**: if `STRIPE_CHECKOUT_ENABLED` is not set or is `false`, "Pay and Book" creates a session with `status: 'pending_payment'` and redirects to the confirmed page without collecting payment.

---

## 1. Stripe Dashboard (Test Mode)

1. **Log in:** [dashboard.stripe.com](https://dashboard.stripe.com) → toggle **Test mode** (top right).
2. **API keys:** Developers → API keys. Copy:
   - **Publishable key** (`pk_test_...`) → `NEXT_PUBLIC_NC_UNITED_STRIPE_KEY`
   - **Secret key** (`sk_test_...`) → `NC_UNITED_STRIPE_SECRET_KEY`
3. **Products (optional):** You can create a Product "Session" and a Price, or create PaymentIntents with ad-hoc amounts (we’ll use amount in cents from booking total).
4. **Webhook (for local dev):** Use Stripe CLI (see below). For Vercel, add a webhook in Dashboard → Developers → Webhooks later.

---

## 2. Environment Variables

In `.env.local` (and in Vercel for production later with **test** keys until you go live):

```env
# Stripe (only needed when STRIPE_CHECKOUT_ENABLED=true)
NEXT_PUBLIC_NC_UNITED_STRIPE_KEY=pk_test_xxxxxxxxxxxx
NC_UNITED_STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
NC_UNITED_STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx

# Set to "true" to enable Stripe Checkout; omit or "false" to skip payment (sessions stay pending_payment)
STRIPE_CHECKOUT_ENABLED=true
```

- Get publishable and secret from Dashboard → API keys (test mode).
- Webhook secret: from Stripe Dashboard → Webhooks → Add endpoint → Signing secret (for production). For local testing, use Stripe CLI `stripe listen` (see below).

---

## 3. Code Changes Overview

| Piece | Purpose |
|-------|--------|
| **POST /api/bookings** | Keep creating session with `status: 'pending_payment'`. Add: create Stripe PaymentIntent (or Checkout Session), store `stripe_payment_intent_id` on session, return `clientSecret` (or checkout URL) to frontend. |
| **POST /api/stripe/webhook** | New route. On `payment_intent.succeeded`, find session by `metadata.session_id`, set `status: 'scheduled'`, `athlete_paid: true`, and optionally `stripe_payment_intent_id` if not already set. |
| **Booking flow (frontend)** | Instead of “Pay and Book” → only POST bookings then redirect: (A) redirect to Stripe Checkout, then redirect back to `/book/.../confirmed?session_id=...`, or (B) use Stripe Elements + PaymentIntent: get `clientSecret` from bookings API, confirm payment, then redirect to confirmed. |

**Recommended for “test data and build out”:** **Stripe Checkout (redirect)**. Easiest: create a Checkout Session in `/api/bookings` (or a small `/api/create-checkout`), redirect parent to Stripe, then success_url to your confirmed page. No card UI to build; Stripe hosts the form. Use test card `4242 4242 4242 4242`.

---

## 4. Option A: Checkout Session (Redirect) – Recommended

**Flow:**  
1. Parent completes steps 1–4 and clicks “Pay and Book”.  
2. Frontend calls API that (a) creates the session row with `pending_payment`, (b) creates a Stripe Checkout Session with `amount_total: totalPrice * 100`, `metadata: { session_id }`, `success_url: /book/[athleteId]/confirmed?session_id=...`, `cancel_url: /book/[athleteId]`.  
3. API returns `{ url }` (Checkout Session URL). Frontend does `window.location.href = url`.  
4. Parent pays on Stripe (test card 4242…).  
5. Stripe redirects to success_url.  
6. Webhook `checkout.session.completed` (or `payment_intent.succeeded` if you attach PaymentIntent to Checkout) updates session to `scheduled` and marks athlete_paid.

**Backend:**  
- In `POST /api/bookings`: after inserting session, create Checkout Session with Stripe SDK, return `{ sessionId, url, partnerInviteCode?, sessionMode? }`. Frontend redirects to `url` if present; otherwise (e.g. no Stripe key) fall back to current “confirm without payment” redirect.  
- Add `POST /api/stripe/webhook`: verify signature, handle `checkout.session.completed` (or `payment_intent.succeeded`), update session by `metadata.session_id`.

**Test data:**  
- Use test keys; use test card `4242 4242 4242 4242`, any future expiry, any CVC. No real money.

---

## 5. Option B: PaymentIntent + Elements (Embedded Form)

**Flow:**  
1. API creates session and PaymentIntent, returns `clientSecret`.  
2. Frontend mounts Stripe Elements, parent enters card, you call `stripe.confirmPayment()`.  
3. On success, redirect to confirmed page.  
4. Webhook `payment_intent.succeeded` updates session to `scheduled` and athlete_paid.

**Backend:**  
- Same as above but create PaymentIntent instead of Checkout Session; return `clientSecret`.  
- Webhook handles `payment_intent.succeeded` and updates session.

**Test data:**  
- Same: test keys, test card 4242… .

---

## 6. Webhook (Local Testing with Test Data)

1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe` (or [install](https://stripe.com/docs/stripe-cli)).
2. Log in: `stripe login`.
3. Forward events to your app:  
   `stripe listen --forward-to localhost:3000/api/stripe/webhook`
4. CLI prints a **webhook signing secret** (`whsec_...`). Put it in `.env.local` as `NC_UNITED_STRIPE_WEBHOOK_SECRET`.
5. Trigger a test payment; CLI forwards the event to your route so you can verify session status updates with test data.

---

## 7. Keeping Test Data While Building

- **Always use test keys** (`pk_test_...`, `sk_test_...`) in dev and on Vercel until you’re ready to go live.
- **Seed data:** Your existing Supabase seed (parents, youth wrestlers, athletes, facilities) stays; bookings created in test mode will reference that data and get `stripe_payment_intent_id` (or Checkout Session id) from Stripe test mode.
- **Test cards:** [Stripe test cards](https://stripe.com/docs/testing#cards): `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline), etc.
- **Coach earnings:** Once webhook updates `status` and `athlete_paid`, coach dashboards can show “cash earned” from real test payments; no live money involved.

---

## 8. Minimal Implementation Checklist

- [x] Add Stripe test keys to `.env.local` (and Vercel env if you deploy).
- [x] In `POST /api/bookings`: create Stripe Checkout Session, return URL; session created with `pending_payment`.
- [x] Add `app/api/stripe/webhook/route.ts`: verify webhook signature, handle `checkout.session.completed`, update session to `scheduled` and `athlete_paid`, and mark `session_participants.paid`.
- [x] In booking flow: if API returns a Stripe URL, redirect to it; after payment Stripe redirects to confirmed page.
- [ ] **Local testing:** Run `stripe listen --forward-to localhost:3000/api/stripe/webhook` and set the printed `whsec_...` as `NC_UNITED_STRIPE_WEBHOOK_SECRET` in `.env.local`, then restart the app.
- [ ] Test end-to-end: complete a booking, pay with card `4242 4242 4242 4242`, confirm session becomes `scheduled` and confirmed page loads.

Once this is in place, you can continue building coach schedule, cash earned, and availability using the same test data and test payments.
