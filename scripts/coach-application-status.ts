/**
 * Inspect a coach’s application / approval state (`users` + `athletes`).
 * Optional `--approve` sets `athletes.status = 'active'` and `athletes.active = true`
 * (same outcome as admin “approve application” for getting off `/coach-pending`).
 *
 * ## Run
 *   npx tsx scripts/coach-application-status.ts --first=Colt --last=Campbell
 *   npx tsx scripts/coach-application-status.ts --id=<uuid>
 *   npx tsx scripts/coach-application-status.ts --id=<uuid> --approve
 *
 * Requires `.env.local` (or env) with Supabase URL + service role key.
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnvLocal() {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return;
  const raw = readFileSync(p, 'utf8');
  for (let line of raw.split('\n')) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
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

function supabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GUILD_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_NC_UNITED_SUPABASE_URL ||
    ''
  );
}

function serviceRoleKey(): string {
  return (
    process.env.GUILD_SUPABASE_SERVICE_KEY ||
    process.env.NC_UNITED_SUPABASE_SERVICE_KEY ||
    ''
  );
}

function parseArgs() {
  let coachId: string | null = null;
  let first = '';
  let last = '';
  let approve = false;
  for (const a of process.argv) {
    if (a.startsWith('--id=')) coachId = a.slice('--id='.length).trim() || null;
    if (a.startsWith('--first=')) first = a.slice('--first='.length).trim();
    if (a.startsWith('--last=')) last = a.slice('--last='.length).trim();
    if (a === '--approve') approve = true;
  }
  return { coachId, first, last, approve };
}

type AthleteRow = {
  id: string;
  first_name: string;
  last_name: string;
  status: string | null;
  active: boolean | null;
  facility_id: string | null;
  secondary_facility_id?: string | null;
  school: string | null;
  rejected_reason?: string | null;
};

async function main() {
  const { coachId, first, last, approve } = parseArgs();
  const url = supabaseUrl();
  const key = serviceRoleKey();
  if (!url || !key) {
    console.error('Missing Supabase URL or GUILD_SUPABASE_SERVICE_KEY (or NC_UNITED).');
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let athletes: AthleteRow[] = [];

  if (coachId) {
    const { data, error } = await admin
      .from('athletes')
      .select(
        'id, first_name, last_name, status, active, facility_id, secondary_facility_id, school, rejected_reason'
      )
      .eq('id', coachId);
    if (error) {
      console.error('athletes query:', error.message);
      process.exit(1);
    }
    athletes = (data ?? []) as AthleteRow[];
  } else if (first && last) {
    const { data, error } = await admin
      .from('athletes')
      .select(
        'id, first_name, last_name, status, active, facility_id, secondary_facility_id, school, rejected_reason'
      )
      .ilike('first_name', first.trim())
      .ilike('last_name', last.trim());
    if (error) {
      console.error('athletes query:', error.message);
      process.exit(1);
    }
    athletes = (data ?? []) as AthleteRow[];
  } else {
    console.error('Usage: --id=<uuid> OR --first=Colt --last=Campbell [--approve]');
    process.exit(1);
  }

  if (athletes.length === 0) {
    console.log('No athlete rows matched.');
    process.exit(0);
  }

  if (athletes.length > 1 && !coachId) {
    console.log(`Multiple matches (${athletes.length}); use --id=<uuid>:\n`);
    for (const a of athletes) {
      console.log(`  ${a.id}  ${a.first_name} ${a.last_name}  status=${a.status ?? 'null'} active=${a.active}`);
    }
    process.exit(1);
  }

  const a = athletes[0]!;
  const { data: userRow, error: userErr } = await admin
    .from('users')
    .select('id, email, role, first_name, last_name')
    .eq('id', a.id)
    .maybeSingle();

  if (userErr) console.error('users query:', userErr.message);

  console.log('--- Coach row ---');
  console.log(JSON.stringify(a, null, 2));
  console.log('--- User row ---');
  console.log(userRow ? JSON.stringify(userRow, null, 2) : '(no users row)');

  const status = a.status ?? 'null';
  const active = a.active === true;
  console.log('\n--- Summary ---');
  console.log(`/coach-pending redirects to dashboard when athletes.status === 'active' (yours: ${status})`);
  console.log(`Booking profile /book requires athletes.active === true (yours: ${a.active})`);
  console.log(`users.role should be 'coach' (yours: ${(userRow as { role?: string } | null)?.role ?? 'n/a'})`);

  if (approve) {
    if (a.status === 'rejected') {
      console.error('\nRefusing --approve: status is rejected.');
      process.exit(1);
    }
    if (a.status === 'active' && a.active === true) {
      console.log('\nAlready active; no update needed.');
      process.exit(0);
    }
    const { error: upErr } = await admin
      .from('athletes')
      .update({
        status: 'active',
        active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', a.id);

    if (upErr) {
      console.error('Update failed:', upErr.message);
      process.exit(1);
    }
    console.log('\nApproved: set status=active, active=true. Coach should land on /athlete-dashboard after refresh.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
