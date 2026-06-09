/**
 * Route Handler: GET /api/portfolio/[address]
 *
 * Accepts query parameters:
 *   - protocol: 'kamino' | 'aave' | 'auto' (default: 'auto')
 *   - chain: Aave chain name or 'all' (default: 'all')
 *
 * Returns a PortfolioResponse JSON object or an error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAddress } from '@/lib/validation';
import { loadKaminoPositions } from '@/lib/clients/kamino';
import { loadAavePositions, resolveChainIds } from '@/lib/clients/aave';
import type { PortfolioResponse } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse> {
  const { address } = await params;
  const searchParams = request.nextUrl.searchParams;
  const protocolParam = searchParams.get('protocol') ?? 'auto';
  const chainParam = searchParams.get('chain') ?? 'all';

  // Validate the address
  const validation = validateAddress(address);
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Determine the protocol
  let protocol = validation.protocol!;
  if (protocolParam !== 'auto') {
    if (protocolParam !== 'kamino' && protocolParam !== 'aave') {
      return NextResponse.json(
        { error: `Unknown protocol '${protocolParam}'; use kamino, aave, or auto` },
        { status: 400 }
      );
    }
    protocol = protocolParam;
  }

  try {
    if (protocol === 'kamino') {
      const positions = await loadKaminoPositions(address);
      const response: PortfolioResponse = { protocol: 'kamino', positions };
      return NextResponse.json(response);
    }

    // Aave
    const chainIds = resolveChainIds(chainParam);
    const positions = await loadAavePositions(address, chainIds);
    const response: PortfolioResponse = { protocol: 'aave', positions };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
