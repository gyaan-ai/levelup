# Coach payouts and taxes

How money flows today, how to actually pay coaches, and how taxes work (US).

---

## Current flow (parent → platform)

1. Parent books and pays via **Stripe Checkout**.
2. Money lands in **your Stripe account** (platform).
3. Webhook marks the session as `scheduled` and `athlete_paid: true` (today this means “parent paid”; see note below).
4. Coaches see “Awaiting payout” for sessions where they haven’t been paid yet.

So: **you hold the cash**; coaches are not paid automatically.

---

## How to actually pay the coaches

You have two main options.

### Option A: Manual payouts (simplest to start)

- **When:** Weekly, biweekly, or monthly (you choose).
- **How:**  
  1. Run a report of completed sessions where the coach hasn’t been paid (e.g. `status = 'completed'` and `athlete_paid = false`, or a dedicated “pay coach” report).  
  2. Pay each coach via **ACH**, **Venmo**, **Zelle**, **check**, etc., using the `athlete_payment` (or your net after platform fee) per session.  
  3. In your app/database, mark the session as paid: set `athlete_paid = true`, `athlete_payout_date = today`, and optionally `stripe_payout_id` if you ever use Stripe for the payout.
- **Pros:** No extra Stripe setup; you control timing and method.  
- **Cons:** Manual work; coaches must share bank/contact details; you handle reconciliation.

You already have `sessions.athlete_payment`, `athlete_paid`, `athlete_payout_date`, and `athletes.stripe_account_id` in the schema; use the first three for manual payouts. `stripe_account_id` is for Option B.

### Option B: Stripe Connect (automated payouts)

- **Idea:** Each coach has a **Stripe Connect** account (Express or Custom). When a parent pays, you can either:  
  - **Destination charge:** Send a share (e.g. coach’s `athlete_payment`) to the coach’s connected account and keep the rest in your account, or  
  - **Separate charges and transfers:** Charge the parent to your account, then create a **Transfer** to the coach’s connected account (on a schedule or after session completion).
- **Flow:**  
  1. Coach onboarding: coach signs up via Stripe Connect (Express onboarding link or Custom form). You store `stripe_account_id` on `athletes`.  
  2. When creating the Checkout Session (or PaymentIntent), you either use `transfer_data.destination` (destination charge) or charge to your account and later call **Transfers API** to send money to the coach.  
  3. When the transfer is created, set `athlete_paid = true`, `athlete_payout_date = today`, `stripe_payout_id = transfer.id`.
- **Pros:** Automated; coach gets paid to their Stripe balance and can payout to their bank; Stripe handles 1099-K if applicable.  
- **Cons:** More integration work; Stripe fees; coach onboarding and support.

For implementation details, see [Stripe Connect](https://stripe.com/docs/connect) and, if you use transfers, [Transfers API](https://stripe.com/docs/transfers).

---

## Important: meaning of `athlete_paid` today

In the current webhook, when the parent’s payment succeeds we set **`athlete_paid: true`**. So right now **`athlete_paid`** is effectively “parent has paid,” not “we have paid the coach.”

For clarity and correct “Awaiting payout” logic, you may want to:

- **Either** rename/adjust: e.g. add a field like **`payment_received`** (set when checkout completes) and use **`athlete_paid`** only when you actually pay the coach (and set **`athlete_payout_date`** then),  
- **Or** keep current behavior and treat “awaiting payout” as “session is paid for by parent but we haven’t paid the coach yet” by only setting **`athlete_paid`** when you run payouts (and stop setting it in the webhook; only set **`payment_received`** or similar in the webhook).

That way reports and coach dashboards clearly separate “parent paid” from “coach paid.”

---

## Taxes (US, high level)

- **Coaches as independent contractors:** If coaches are not employees, they are typically **1099 contractors**. You do **not** withhold income or FICA; they are responsible for their own taxes and self-employment tax.
- **Your obligations:**  
  - **1099-NEC:** If you pay a coach **$600 or more** in a calendar year (for services), you must collect a **W-9** and issue a **1099-NEC** by Jan 31.  
  - **1099-K:** If you use a payment processor (e.g. Stripe), they may issue **1099-K** to coaches (and/or you) if IRS thresholds are met. Stripe’s documentation and dashboard describe when they do this.  
  - **Record-keeping:** Keep records of all payments to coaches (date, amount, session/service) for 1099s and in case of audit.
- **Platform fee / withholding:** If you keep a platform fee, you only pay the coach their share (e.g. `athlete_payment`). You don’t withhold tax from that share unless they’re employees (which is a different setup).
- **CPA:** For your entity structure, sales tax (if any), and exact 1099/W-9 workflow, use a **CPA or tax attorney**; this doc is only an overview.

---

## Practical checklist (manual payouts)

1. **W-9:** Before paying a coach over $600 in a year, collect a **W-9** and store it (secure).  
2. **Admin → Coach payouts:** Use the Coach payouts tab to see who is owed how much and their Venmo/Zelle (coaches enter these at sign-up and in Profile). Previously: build an admin report: “Sessions completed, parent paid, coach not yet paid” (e.g. `status = 'completed'`, payment received, `athlete_paid = false`).  
3. **Pay:** Send money via your chosen method (ACH, Venmo, etc.).  
4. **Record:** Mark each session as paid: `athlete_paid = true`, `athlete_payout_date = <date>`.  
5. **1099:** At year end, if a coach got ≥ $600, issue **1099-NEC** and file with the IRS (and state if required). Use software or a CPA.

---

## Summary

| Topic | Summary |
|-------|--------|
| **Who holds the money today** | Your Stripe (platform) account after parent pays. |
| **Paying coaches** | Manual (ACH, Venmo, etc.) or Stripe Connect; update `athlete_paid` and `athlete_payout_date` when you pay. |
| **Taxes** | Treat coaches as 1099 contractors; collect W-9, issue 1099-NEC if ≥ $600/year; keep records; get a CPA for your situation. |
| **`athlete_paid`** | Consider using it only for “we paid the coach” and a separate field for “parent paid.” |
