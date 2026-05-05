import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: draft } = await supabase
    .from('drafts').select('admin_user_id').eq('id', id).single();
  if (!draft || draft.admin_user_id !== user.id)
    return NextResponse.json({ error: 'Not your draft' }, { status: 403 });

  const { data: runs, error } = await supabase
    .from('cron_runs').select('*').eq('draft_id', id)
    .order('ran_at', { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: runs ?? [] });
}
