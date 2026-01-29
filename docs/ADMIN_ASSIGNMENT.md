# Assigning Admin Users

Admins can access the Admin Dashboard (`/admin`) to view sessions, users, billing, and athlete reports. Admin cannot be self-assigned via signup.

## Option 1: Environment variable (recommended)

Set **`ADMIN_EMAILS`** in your environment (e.g. `.env.local`, Vercel). Use a comma‑separated list of emails. Those users are promoted to `admin` on **login** (and on OAuth callback).

```bash
ADMIN_EMAILS=admin@example.com,other@example.com
```

- Users must already exist (sign up as Parent or NCAA Wrestler, then add their email to `ADMIN_EMAILS`).
- On next login, their `users.role` is set to `admin` automatically.
- Case-insensitive; leading/trailing spaces are trimmed.

## Option 2: Direct database update

Run in the **Supabase SQL Editor** (or via migrations):

```sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'admin@example.com';
```

To revoke admin:

```sql
UPDATE public.users
SET role = 'parent'
WHERE email = 'admin@example.com';
```

## Security

- **Signup**: The public signup form no longer offers "Admin". The signup API rejects `role: 'admin'`.
- **Promotion**: Only emails listed in `ADMIN_EMAILS` or manually updated in the DB can have admin. Keep `ADMIN_EMAILS` secret and restrict who can change env vars.
