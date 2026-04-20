# Twilio SMS for coach alerts

When someone books or signs up for a coach’s session, the coach gets:

1. **In-app notification** (always) — “Someone signed up for your session … Check My sessions.”
2. **SMS** (optional) — if Twilio is configured and the coach has a phone on file.

## Env vars

Add to `.env.local` (and your host’s env, e.g. Vercel):

- `TWILIO_ACCOUNT_SID` — from Twilio console
- `TWILIO_AUTH_TOKEN` — from Twilio console  
- `TWILIO_FROM_NUMBER` — Twilio phone number (e.g. +1XXXXXXXXXX)
- **`ADMIN_BOOKING_ALERT_PHONES`** (optional) — comma-separated cell numbers (10-digit US or E.164) that receive an **ops** copy of every booking/signup SMS (in addition to the coach). Same number as the coach is only texted once (coach copy).

You can also omit that env and rely on **`users.phone`** for every user with **`role = admin`** — those numbers get the same ops copy (deduped with the env list).

## Coach phone

We look for a coach phone in this order:

1. **`users.phone`** — cell number from coach onboarding / profile (migration `20240320000000_users_phone.sql`). Same column parents use on Account.
2. **`athletes.zelle_email`** — Zelle field accepts “email or phone”. If the value looks like a phone (e.g. 10+ digits), we use it for SMS so coaches who already entered their cell for Zelle get alerts without a second field.

If neither is set or neither looks like a valid phone, we only send the in-app notification.

## Where SMS is sent

- **Coach** — same as before: `users.phone` or phone-shaped `athletes.zelle_email`.
- **Ops / admin** — on the same events, a second message goes to `ADMIN_BOOKING_ALERT_PHONES` and to every admin user with `users.phone` (see `notifyCoachAndAdminsNewBooking` in `lib/twilio.ts`).

- **Stripe webhook** — after a paid booking or signup (`checkout.session.completed`): private booking, register path, and cart checkout; in-app notification + SMS if phone set.
- **Register API** — after a free/direct signup (session owner add, or free small group): in-app notification + SMS if phone set.
- **Cart checkout (credits only)** — when the cart is fully paid with credits (no Stripe): in-app notification + SMS if phone set (one SMS per session per checkout).
- **Private booking API** — when the charge is below Stripe’s minimum and the session is confirmed without card payment: SMS in addition to the existing in-app notification at booking time.

## Testing

1. Set Twilio env vars and ensure `users.phone` exists (see migration `20240320000000_users_phone.sql`).
2. Set a coach’s phone via onboarding, coach profile, or SQL on `users.phone`.
3. Have a parent (or you) sign up for that coach’s session; coach should get in-app notification and an SMS.
