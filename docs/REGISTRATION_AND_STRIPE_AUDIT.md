# Registration, Stripe & roster display — audit (living doc)

**Purpose:** One map of how parents get onto sessions, how money ties in, and where the product can drift or fail in production. Update this when flows change.

---

## 1. Source of truth

| Data | Meaning |
|------|--------|
| **`session_participants`** | Who is registered for a session (kid + parent + paid flags). **This is the roster.** |
| **`sessions.current_participants`** | Denormalized count for capacity. **Can drift** if a code path inserts/deletes a row without updating this column, or if ops fixes rows in SQL. |
| **Stripe** | Payments. Rows are **not** created by Stripe alone; **webhook + app code** must insert/update `session_participants`. |

**Rule:** Any UI that shows “X/Y spots” or names should prefer **`COUNT(session_participants)` or embedded `session_participants` length** over trusting **`sessions.current_participants` alone** (recent code uses `getEffectiveFilledCount` / listed-name reconciliation).

**Hardening option:** Postgres `AFTER INSERT OR DELETE ON session_participants` trigger to set `sessions.current_participants` from `COUNT(*)` so the column cannot drift.

---

## 2. Flows (parent → session)

### A. Public / invite-only session registration (small group, join link)

1. Parent opens **`/join/{code}`** or registers from **`/sessions/{id}/register`**.
2. **`POST /api/sessions/[id]/register`** creates Stripe Checkout with metadata: `register=true`, `session_id`, `youth_wrestler_id`, `parent_id`, `tenant_slug`.
3. **`checkout.session.completed` webhook** (`app/api/stripe/webhook/route.ts`): if `register=true`, inserts/updates **`session_participants`** and bumps **`sessions.current_participants`** (or idempotent update if already there).
4. **`/sessions/{id}/register/confirmed`** + **`finalizeRegisterFromCheckoutSession`** + **`registration-status`** poll: backup if webhook is slow.

**Failure modes:** Missing metadata (now 500, no silent fall-through), webhook delay, double clicks (mitigated by idempotency + locks), manual SQL without updating `current_participants`.

**Production domain mismatch (paid in Stripe, no roster / parent “invisible”):** If `getTenantByDomain(host)` returned `null` for your real hostname (domain not listed in `config/tenants.ts` and `NEXT_PUBLIC_APP_URL` not set or wrong), the register **confirmed** page could **404 before `finalizeRegisterFromCheckoutSession`**, and **`GET registration-status`** could **404** — so the UI never created `session_participants` even though Checkout succeeded. **Mitigations in code:** (1) `NEXT_PUBLIC_APP_URL` hostname is treated as guild; (2) finalize + webhook resolve **Supabase tenant from Checkout `metadata.tenant_slug`**; (3) confirmed page allows single-tenant fallback when `stripe_cs` is present; (4) registration-status falls back to guild so polling works. **You should still set `NEXT_PUBLIC_APP_URL` in Vercel to your canonical site URL.**

### B. Partner / invite link join (no Stripe on join route in some modes)

- **`POST /api/sessions/join`**: inserts participant, increments count (partner-invite / partner-open).
- Capacity checks must use **row count** or shared helper, not column alone (partially addressed in register API).

### C. Session join requests (coach approves)

- **`PATCH session-join-requests`**: approve → insert **`session_participants`**, increment count. Full check should align with **`COUNT`** pattern.

### D. Private booking (book coach flow)

- **`POST /api/bookings`**: creates **`sessions`** + initial **`session_participants`** rows; payment may be Checkout elsewhere; webhook path **`register` ≠ true`** updates session payment state — **must never be confused with register path** (guarded in webhook).

---

## 3. Stripe touchpoints (code)

| Location | Role |
|----------|------|
| `app/api/sessions/[id]/register/route.ts` | Checkout Session for **register**; idempotency; capacity via **COUNT** + `getEffectiveFilledCount` |
| `app/api/stripe/webhook/route.ts` | **`register=true`** → roster insert; else booking-style session update |
| `lib/finalize-session-register-from-stripe.ts` | Confirmed page / paid-session replay |
| `app/api/sessions/[id]/registration-status/route.ts` | Polling for parent after pay |

**Ops:** Stripe Dashboard → Webhooks → failed deliveries; Vercel logs for `POST /api/stripe/webhook`.

---

## 4. UI surfaces (where counts/names appear)

| Surface | Notes |
|---------|--------|
| `/join/[code]` | Roster list + capacity; **`dynamic`**, no stale cache |
| `/sessions/[id]` | Session card; badge uses **effective fill** vs listed names |
| `/training`, `/find-training` | Session cards; uses **`getEffectiveFilledCount`** from embedded participants |
| Partner sessions | Same |
| Admin dashboards | Must match same DB; consider showing **COUNT** vs column for debugging |

**Gap:** No first-class **admin “add/remove roster row”** UI — forces SQL for edge cases. **Recommendation:** Admin action: “Sync count from roster” + “Add wrestler to session” (service role).

---

## 5. Production checklist (before telling a parent “you’re in”)

1. Row exists: **`session_participants`** for that **`session_id`** + **`youth_wrestler_id`**.
2. Optional: **`sessions.current_participants`** = `COUNT(*)` for that session (SQL in `scripts/sync-session-current-participants.sql`).
3. UI: join link or session page shows the kid (hard refresh / deploy if caching).
4. Stripe: charge/refund state matches what you told the parent (support, not roster).

---

## 6. Suggested next engineering passes (priority)

1. **DB trigger** (or periodic job) to keep **`current_participants`** = `COUNT(session_participants)` per session.
2. **Admin roster tools** (add/remove + sync count) — no SQL for ops.
3. **Alerts:** Stripe webhook 5xx or “register metadata missing” → Slack/email.
4. **E2E test:** happy path register → webhook (Stripe CLI) → row appears → join page lists name.
5. **Migrations:** Ensure prod has **`roster_*`** columns on **`session_participants`** if code expects them; or code must not require them (join page fallbacks).

---

## 7. Related scripts

- `scripts/sync-session-current-participants.sql` — reconcile counts from roster.
- `scripts/verify-session-roster.js` — local verify against `.env.local` (optional).

---

*Last updated: session capacity + register COUNT alignment (`getEffectiveFilledCount`, session detail / join dynamic).*
