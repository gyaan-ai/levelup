# Supabase Database Migrations

This directory contains SQL migration files for the LevelUp database schema.

## Running Migrations

### Option 1: Using Supabase CLI (Recommended)

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link your project:
   ```bash
   supabase link --project-ref zbpjayhcnnasfddasnpi
   ```

3. Run migrations:
   ```bash
   supabase db push
   ```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `migrations/20240105000000_initial_schema.sql`
4. Run the SQL script

### Option 3: Using psql

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.zbpjayhcnnasfddasnpi.supabase.co:5432/postgres" < supabase/migrations/20240105000000_initial_schema.sql
```

## Migration Files

- `20240105000000_initial_schema.sql` - Initial database schema with all tables, indexes, triggers, and RLS policies

## Schema Overview

- **users** - User accounts (extends auth.users)
- **facilities** - Wrestling facilities
- **athletes** - College wrestler profiles
- **sessions** - Booking sessions
- **credit_pools** - Parent credit pool purchases
- **reviews** - Session reviews and ratings
- **athlete_availability** - Athlete availability schedule
- **blocked_times** - Admin-blocked facility times





