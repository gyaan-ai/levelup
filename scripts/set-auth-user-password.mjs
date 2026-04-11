#!/usr/bin/env node
/**
 * Set a user's password directly via Supabase Auth Admin (no email; works when recovery email is rate-limited).
 *
 * Usage (from repo root, with .env.local present):
 *   node scripts/set-auth-user-password.mjs <REAL_USER_EMAIL> <new-password>
 *
 * Use single quotes if the password contains ! (zsh history expansion).
 * Replace REAL_USER_EMAIL with the exact email from Supabase → Authentication → Users
 * (do not use placeholder text from docs).
 *
 * Or pass URL + service key via env:
 *   NEXT_PUBLIC_GUILD_SUPABASE_URL=https://xxx.supabase.co \
 *   GUILD_SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/set-auth-user-password.mjs coach@realdomain.com 'TempPass1!'
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnvLocal() {
  const p = join(__dirname, '..', '.env.local');
  if (!existsSync(p)) return;
  const raw = readFileSync(p, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnvLocal();

const url =
  process.env.NEXT_PUBLIC_GUILD_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_NC_UNITED_SUPABASE_URL;
const serviceKey =
  process.env.GUILD_SUPABASE_SERVICE_KEY ||
  process.env.NC_UNITED_SUPABASE_SERVICE_KEY;

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Usage: node scripts/set-auth-user-password.mjs <email> <new-password>');
  console.error('Example: node scripts/set-auth-user-password.mjs coach@school.edu \'TempPass99!\'');
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_GUILD_SUPABASE_URL or GUILD_SUPABASE_SERVICE_KEY (check .env.local).');
  process.exit(1);
}
if (newPassword.length < 6) {
  console.error('Password must be at least 6 characters (Supabase default).');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const target = email.toLowerCase().trim();
let user = null;
let pageNum = 1;
const perPage = 1000;

while (pageNum <= 200) {
  const { data: page, error: listErr } = await admin.auth.admin.listUsers({
    page: pageNum,
    perPage,
  });

  if (listErr) {
    console.error('listUsers:', listErr.message);
    process.exit(1);
  }

  const users = page.users ?? [];
  user = users.find((u) => (u.email || '').toLowerCase() === target);
  if (user) break;
  if (users.length < perPage) break;
  pageNum += 1;
}

if (!user) {
  console.error(`No auth user found with email: ${email}`);
  console.error('');
  console.error('Common fixes:');
  console.error('  • Use the person’s real login email (copy from Supabase → Authentication → Users), not placeholder text from the readme.');
  console.error('  • Confirm .env.local uses the SAME Supabase project as production (URL + service key) if you expect that user to exist.');
  process.exit(1);
}

const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
  password: newPassword,
});

if (updErr) {
  console.error('updateUserById:', updErr.message);
  process.exit(1);
}

console.log(`Password updated for ${email} (${user.id}). They can sign in with the new password.`);
