import { NextResponse } from 'next/server';
import { fetchEspnInjuries } from '@/lib/nhl-api';

export async function GET() {
  const injuries = await fetchEspnInjuries();
  const obj: Record<string, { status: string; description: string | null }> = {};
  injuries.forEach((info, name) => {
    obj[name] = info;
  });
  return NextResponse.json(obj);
}
