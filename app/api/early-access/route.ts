import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimStr(s: unknown, max: number): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  return t.length ? t.slice(0, max) : null;
}

function parseYear(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) && n >= 2020 && n <= 2040 ? n : null;
}

function parseDate(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v.trim());
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({})) as {
      email?: string;
      name?: string;
      interest?: string;
      parent_name?: string;
      wrestler_name?: string;
      school_club?: string;
      graduation_year?: number | string;
      dob?: string;
      parent_phone?: string;
      weight_class?: string;
      experience_level?: string;
    };

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const admin = createAdminClient(tenant.slug);
    const { error } = await admin.from('early_access').insert({
      email: email.toLowerCase(),
      name: trimStr(body.name ?? body.parent_name, 200),
      interest: trimStr(body.interest, 500) || null,
      parent_name: trimStr(body.parent_name, 200) || null,
      wrestler_name: trimStr(body.wrestler_name, 200) || null,
      school_club: trimStr(body.school_club, 200) || null,
      graduation_year: parseYear(body.graduation_year),
      dob: parseDate(body.dob),
      parent_phone: trimStr(body.parent_phone, 30) || null,
      weight_class: trimStr(body.weight_class, 50) || null,
      experience_level: trimStr(body.experience_level, 100) || null,
    });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: true, message: "You're already on the list. We'll be in touch." });
      }
      console.error('Early access insert error:', error);
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "You're on the list. We'll be in touch soon." });
  } catch (e) {
    console.error('Early access API error:', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
