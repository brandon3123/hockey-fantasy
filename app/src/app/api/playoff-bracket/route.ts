import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const year = searchParams.get('year') || '2026';

  try {
    const response = await fetch(`https://api-web.nhle.com/v1/playoff-bracket/${year}`);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch playoff bracket: ${response.status}` },
        { status: response.status }
      );
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load playoff bracket' },
      { status: 500 }
    );
  }
}