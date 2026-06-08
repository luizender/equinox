import { NextRequest, NextResponse } from 'next/server';
import { resolveKaminoReserve } from '@/lib/kamino-client';
import { resolveAaveReserve } from '@/lib/aave-client';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const protocol = searchParams.get('protocol');
  const marketId = searchParams.get('marketId');
  const symbol = searchParams.get('symbol');
  const user = searchParams.get('user') ?? '0x0000000000000000000000000000000000000000';

  if (!protocol || !marketId || !symbol) {
    return NextResponse.json(
      { error: 'Missing required query parameters: protocol, marketId, symbol' },
      { status: 400 }
    );
  }

  try {
    if (protocol === 'kamino') {
      const data = await resolveKaminoReserve(marketId, symbol);
      return NextResponse.json(data);
    } else if (protocol === 'aave') {
      const data = await resolveAaveReserve(user, marketId, symbol);
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ error: `Invalid protocol '${protocol}'` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
