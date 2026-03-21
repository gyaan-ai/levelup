# Twilio SMS for coach alerts

When someone signs up for a coach’s session, the coach gets:

1. **In-app notification** (always) — “Someone signed up for your session … Check My sessions.”
2. **SMS** (optional) — if Twilio is configured and the coach has a phone on file.

## Env vars

Add to `.env.local` (and your host’s env, e.g. Vercel):

- `TWILIO_ACCOUNT_SID` — from Twilio console
- `TWILIO_AUTH_TOKEN` — from Twilio console  
- `TWILIO_FROM_NUMBER` — Twilio phone number (e.g. +1XXXXXXXXXX)

## Coach phone

We look for a coach phone in this order:

1. **`users.phone`** — cell number from coach onboarding / profile (migration `20240320000000_users_phone.sql`). Same column parents use on Account.
2. **`athletes.zelle_email`** — Zelle field accepts “email or phone”. If the value looks like a phone (e.g. 10+ digits), we use it for SMS so coaches who already entered their cell for Zelle get alerts without a second field.

If neither is set or neither looks like a valid phone, we only send the in-app notification.

## Where SMS is sent

- **Stripe webhook** — after a paid signup (checkout.session.completed, register payment path): in-app notification + SMS if phone set.
- **Register API** — after a free/direct signup (session owner add, or free small group): in-app notification + SMS if phone set.

## Testing

1. Set Twilio env vars and ensure `users.phone` exists (see migration `20240320000000_users_phone.sql`).
2. Set a coach’s phone via onboarding, coach profile, or SQL on `users.phone`.
3. Have a parent (or you) sign up for that coach’s session; coach should get in-app notification and an SMS.
