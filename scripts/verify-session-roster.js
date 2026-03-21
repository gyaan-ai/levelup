#!/usr/bin/env node
/**
 * Verify who is on a session roster (session_participants).
 *
 * Usage:
 *   node scripts/verify-session-roster.js
 *   SESSION_ID=uuid node scripts/verify-session-roster.js
 *   SEARCH=logan node scripts/verify-session-roster.js
 *
 * Requires .env.local with NEXT_PUBLIC_GUILD_SUPABASE_URL + GUILD_SUPABASE_SERVICE_KEY
 * (or NC_UNITED_* legacy names).
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env.local at project root.');
    process.exit(1);
  }
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

const env = loadEnvLocal();
const url =
  env.NEXT_PUBLIC_GUILD_SUPABASE_URL ||
  env.NEXT_PUBLIC_NC_UNITED_SUPABASE_URL;
const key =
  env.GUILD_SUPABASE_SERVICE_KEY ||
  env.NC_UNITED_SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error(
    'Need NEXT_PUBLIC_GUILD_SUPABASE_URL (or NEXT_PUBLIC_NC_UNITED_SUPABASE_URL) and GUILD_SUPABASE_SERVICE_KEY (or NC_UNITED_SUPABASE_SERVICE_KEY) in .env.local'
  );
  process.exit(1);
}

// Sabino Mar 22 2026 11am ET session (join code 3766VV2F)
const DEFAULT_SESSION_ID = '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85';
const sessionId = process.env.SESSION_ID || DEFAULT_SESSION_ID;
const search = (process.env.SEARCH || 'logan').toLowerCase().trim();

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await supabase
    .from('session_participants')
    .select(
      'id, session_id, youth_wrestler_id, parent_id, paid, amount_paid, roster_first_name, roster_last_name, youth_wrestlers(first_name, last_name)'
    )
    .eq('session_id', sessionId);

  if (error) {
    console.error('Query error:', error.message);
    process.exit(1);
  }

  const rows = data || [];
  console.log('\nSession:', sessionId);
  console.log('Roster count:', rows.length);
  console.log('---');

  const names = rows.map((r) => {
    const yw = r.youth_wrestlers;
    const o = Array.isArray(yw) ? yw[0] : yw;
    const first = r.roster_first_name || o?.first_name || '';
    const last = r.roster_last_name || o?.last_name || '';
    const full = `${first} ${last}`.trim();
    return {
      full,
      youth_wrestler_id: r.youth_wrestler_id,
      participant_row_id: r.id,
      paid: r.paid,
    };
  });

  for (const n of names) {
    console.log(`- ${n.full || '(no name)'} | youth_wrestler_id=${n.youth_wrestler_id} | paid=${n.paid}`);
  }

  if (search) {
    const hits = rows.filter((r) => {
      const yw = r.youth_wrestlers;
      const o = Array.isArray(yw) ? yw[0] : yw;
      const first = (r.roster_first_name || o?.first_name || '').toLowerCase();
      const last = (r.roster_last_name || o?.last_name || '').toLowerCase();
      return first.includes(search) || last.includes(search);
    });

    console.log('---');
    if (hits.length > 0) {
      console.log(`MATCH "${search}": YES — ${hits.length} row(s)`);
      console.log(JSON.stringify(hits, null, 2));
    } else {
      console.log(`MATCH "${search}": NO — not in session_participants for this session.`);
    }
  }

  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
