# Deployment Fixes for Vercel

## Issues Fixed

### 1. Missing Logo/Favicon (404 errors)
- **Fixed**: Added error handling to hide logo if file doesn't exist
- **Fixed**: Added favicon metadata to layout
- **Action**: Create actual logo files in `/public/logos/` when ready

### 2. `/api/auth/login` 404 Error
- **Fixed**: Updated signup page to use Supabase client directly instead of API route
- **Reason**: The login page already uses Supabase client directly, so signup should too for consistency

### 3. Users Table 500 Error
- **Issue**: RLS policy might be blocking queries
- **Fixed**: Created migration `20240105000002_fix_users_rls.sql` to improve RLS policies
- **Action Required**: Run this migration in Supabase SQL Editor

## Required Actions

### 1. Run RLS Fix Migration

Go to your Supabase SQL Editor and run:
```
supabase/migrations/20240105000002_fix_users_rls.sql
```

This will:
- Fix RLS policies for users table
- Allow users to read their own records
- Allow admins to read all users
- Add INSERT and UPDATE policies

### 2. Create Logo Files (Optional)

Create these files in `/public/logos/`:
- `nc-united.png` - NC United Wrestling logo

Or update `config/tenants.ts` to remove the logo reference if not needed yet.

### 3. Create Proper Favicon

Replace `/public/favicon.ico` with an actual favicon file.

## Testing After Fixes

1. Sign up as a new user
2. Log in with existing credentials
3. Check browser console for any remaining errors
4. Verify user role is loaded correctly in header





