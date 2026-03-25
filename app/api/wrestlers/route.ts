import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ wrestlers: [] });
  }

  const { data: wrestlers, error } = await supabase
    .from('youth_wrestlers')
    .select('id, first_name, last_name')
    .eq('parent_id', user.id)
    .order('first_name');

  if (error) {
    return NextResponse.json({ wrestlers: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wrestlers: wrestlers ?? [] });
}
