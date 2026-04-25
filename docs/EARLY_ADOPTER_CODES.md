# Discount codes (signup & account)

## Current behavior

- **Signup** (`/api/auth/signup`): Parents may enter an optional discount code. Valid codes must exist in `discount_codes`, be active, and resolve to a **percent-off** value. On success the parent gets a row in `parent_percentage_discounts` (and the code’s redemption count increments). **New signups do not create `early_adopter_entitlements` rows.**
- **Redeem after signup** (`/api/redeem-discount-code`, Account → Rewards): Same rules — percent-off codes only.
- **Book-a-coach** (`/book/...`): Uses normal coach pricing, promos, wallet credits, and Stripe. It does **not** treat legacy entitlements as “free early adopter” in the UI.

## Legacy: `early_adopter_entitlements`

Older migrations and **Admin → Grant early adopter** may still have created rows in `early_adopter_entitlements`. Those rows are **not** granted by current signup or redeem flows. Stripe checkout metadata may still include `early_adopter_entitlement_id` on some legacy paths; the webhook may decrement `remaining` when present.

---

## Where parents enter a code

### 1. At signup

**Signup page** (`/signup`):

1. Parent selects role **Parent**.
2. Field **Discount code (optional)** (e.g. `FAMILY10` or a code you created in Admin).
3. Submit: code is validated; percent-off is stored for that parent.

Coaches and youth wrestlers do not see this field.

### 2. After signup (Account)

1. **Account** → **Rewards** → enter code → **Apply**.

---

## Admin

- **Discount codes** (`/admin/discount-codes`): Create codes and set **Percent off**.  
- **Grant early adopter** (User Management): Legacy operation; inserts `early_adopter_entitlements` for ops/testing. Does not change how percent-off signup works.

---

## How codes are stored

- **Table:** `discount_codes` — `code`, optional `name`, `max_redemptions`, `redemptions`, `active`, `percent_off`.
- **Applied discount:** `parent_percentage_discounts` links a parent to `percent_off` after signup or redeem.

---

## “Code not found” when testing

1. Ensure the row exists in `discount_codes` for this Supabase project (migrations or Admin).
2. Code must have **Percent off** set (or match a known family code pattern in `lib/discount-codes`).
3. Confirm you’re on the correct environment (staging vs production).

---

## Summary

| Question | Answer |
|----------|--------|
| **Where?** | Signup (Parent) optional field, or Account → Rewards. |
| **What do they get?** | Percentage off sessions (`parent_percentage_discounts`), not automatic $0 booking in book-a-coach. |
| **Manage codes** | Admin → Discount codes. |
