import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getIsAdmin } from '@/lib/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ isAdmin: false });
  }

  const isAdmin = await getIsAdmin(user.id);
  return NextResponse.json({ isAdmin });
}
