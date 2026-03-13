# Early adopter / discount codes

## Where parents can add the code

### 1. At signup

**Signup page** (`/signup`):

1. Parent selects role **Parent**.
2. A field appears: **Discount code (optional)** with placeholder `e.g. GUILDLAUNCH`.
3. Description: *Early adopters: enter your code for 1 free private + 1 free small group session*.
4. They submit signup with the code; the API validates it and, if valid, grants 1 free 1-on-1 and 1 free small group (2-athlete) entitlement.

Only **parents** see this field. Coaches and youth wrestlers do not.

### 2. After signup (Account page)

If a parent **did not** enter the code at signup, they can redeem it later:

1. Parent goes to **Account** (bottom nav).
2. Card **Redeem discount code**: enter the code (e.g. GUILDLAUNCH) and tap **Redeem code**.
3. Same validation as signup (code must exist, not over limit, and they must not have already used it). On success they get 1 free 1-on-1 + 1 free 2-athlete.

If they already have early adopter entitlements, the card shows that and does not show the form.

### 3. Admin grant (for existing parents who didn’t use a code)

Admins can grant early adopter benefits to any parent without a code:

1. Go to **Admin → User Management** (`/admin/users`).
2. Find the parent in the list.
3. Click **Grant early adopter** (gift icon). This grants 1 free private + 1 free small group without using a discount code (stored as `ADMIN_GRANT`).
4. If the parent already has entitlements, the API returns an error and no change is made.

---

## How codes work

- **Table:** `discount_codes`  
  - `code` – unique text (e.g. `GUILDLAUNCH`), matched case-insensitively at signup.  
  - `name` – optional label (e.g. Early Adopter).  
  - `max_redemptions` – cap on uses; `NULL` = unlimited.  
  - `redemptions` – current use count (incremented on each valid signup).

- **Validation:** Signup API (`/api/auth/signup`) looks up the code (trimmed, uppercased). If not found or over limit, signup returns an error. If valid, it creates the user and inserts two rows into `early_adopter_entitlements` (1-on-1 and 2-athlete, each `remaining: 1`).

---

## How to generate / manage codes

### Option A: Seed in a migration (current)

The migration `20240143000000_early_adopter_discount.sql` seeds one code:

```sql
INSERT INTO public.discount_codes (code, name, max_redemptions)
VALUES ('GUILDLAUNCH', 'Early Adopter', 50)
ON CONFLICT (code) DO NOTHING;
```

To add more codes, run SQL (e.g. in Supabase SQL editor or a new migration):

```sql
INSERT INTO public.discount_codes (code, name, max_redemptions)
VALUES ('YOURCODE', 'Your campaign name', 100);  -- or max_redemptions NULL for unlimited
```

### Option B: Admin UI (recommended)

Use **Admin → Discount codes** (`/admin/discount-codes`) to:

- List existing codes (code, name, redemptions, max, created).
- Create a new code: enter code string, optional name, optional max redemptions (leave blank for unlimited).

Codes are stored in `discount_codes`; the signup API already reads from that table. No code generation algorithm – you choose the code string (e.g. `BETA2025`, `GUILDLAUNCH`).

---

## Summary

| Question | Answer |
|----------|--------|
| **Where do they put the code?** | Signup page, when role is Parent: optional field **Discount code**. |
| **How do we generate the code?** | You define the code string yourself. Add it via SQL or Admin → Discount codes. No auto-generation. |
| **Current code** | `GUILDLAUNCH` (Early Adopter, max 50 redemptions), seeded in migration. |
