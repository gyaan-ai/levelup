# Run Migrations on Production Supabase

For collaboration (messages) and video upload to work, you need to run migrations on your **production** Supabase project.

## Quick fix for workspace_messages error

If you see: *"Could not find the table 'public.workspace_messages' in the schema cache"*

### Option 1: Supabase Dashboard (easiest)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. Open **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/20240120000000_workspace_messages.sql`
4. Click **Run**

### Option 2: Supabase CLI

```bash
# Link to your production project (if not already)
supabase link --project-ref YOUR_PROJECT_REF

# Push all pending migrations
supabase db push
```

### Option 3: Run migration file directly

```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" -f supabase/migrations/20240120000000_workspace_messages.sql
```

Replace `[PASSWORD]` and `[HOST]` with your Supabase project credentials (Project Settings → Database).

## Migrations included

- `20240118000000_workspaces.sql` – Workspaces, goals, media, session notes, actions, workspace-media storage bucket
- `20240120000000_workspace_messages.sql` – Collaboration messages table

If workspace features or video upload fail, ensure both migrations have been run on production.
