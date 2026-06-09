import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveChainIds } from '../src/lib/clients/aave';

// --------------------------------------------------------------------------- //
// Test the Aave chain resolver (pure logic, no network)
// --------------------------------------------------------------------------- //

describe('resolveChainIds', () => {
  it('returns all chains when no argument is given', () => {
    const ids = resolveChainIds();
    expect(ids.length).toBeGreaterThan(10);
    expect(ids).toContain(1); // ethereum
    expect(ids).toContain(42161); // arbitrum
  });

  it('returns all chains when "all" is passed', () => {
    const ids = resolveChainIds('all');
    expect(ids.length).toBeGreaterThan(10);
  });

  it('returns a single chain ID for a valid chain name', () => {
    expect(resolveChainIds('ethereum')).toEqual([1]);
    expect(resolveChainIds('arbitrum')).toEqual([42161]);
    expect(resolveChainIds('base')).toEqual([8453]);
  });

  it('is case-insensitive', () => {
    expect(resolveChainIds('Ethereum')).toEqual([1]);
    expect(resolveChainIds('ARBITRUM')).toEqual([42161]);
  });

  it('throws for an unknown chain name', () => {
    expect(() => resolveChainIds('fakenet')).toThrow("Unknown chain 'fakenet'");
  });
});

// --------------------------------------------------------------------------- //
// Test Kamino API parser functions via the buildPosition helper
// --------------------------------------------------------------------------- //

describe('Kamino response parsing', () => {
  const mockKaminoLoanDetail = {
    loanInfo: {
      collateral: {
        deposits: [
          {
            tokenName: 'JupSOL',
            tokenAmount: '57543.3696',
            tokenPrice: '80.71',
            liquidationLtv: '0.60',
          },
        ],
      },
      debt: {
        borrows: [
          {
            tokenName: 'PYUSD',
            tokenAmount: '2042156.91',
            tokenPrice: '1.00',
            tokenValue: '2041983.60',
            borrowFactor: '1.0',
          },
        ],
      },
    },
  };

  const mockKaminoReserveMetrics = [
    { liquidityToken: 'JupSOL', reserve: 'RSV_JUPSOL', supplyApy: 0.07, borrowApy: 0.09 },
    { liquidityToken: 'PYUSD', reserve: 'RSV_PYUSD', supplyApy: 0.05, borrowApy: 0.08 },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses Kamino loan detail into a PortfolioPosition', async () => {
    // Mock fetch to return canned responses
    const fetchMock = vi.fn();

    // Portfolio response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lending: [{ address: 'OBL1', marketAddress: 'MKT1' }],
      }),
    });

    // Market metadata
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Main Market' }),
    });

    // Reserve metrics (per-asset supply/borrow APY)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockKaminoReserveMetrics,
    });

    // Loan detail
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockKaminoLoanDetail,
    });

    vi.stubGlobal('fetch', fetchMock);

    const { loadKaminoPositions } = await import('../src/lib/clients/kamino');
    const positions = await loadKaminoPositions('SomeWallet');

    expect(positions).toHaveLength(1);
    const pos = positions[0];
    expect(pos.marketName).toBe('Main Market');
    expect(pos.address).toBe('OBL1');
    expect(pos.marketId).toBe('MKT1');
    // Kamino reports neither a net APY nor a health factor.
    expect(pos.netApy).toBeNull();
    expect(pos.healthFactor).toBeNull();

    // Collateral
    expect(pos.collateral).toHaveLength(1);
    expect(pos.collateral[0].symbol).toBe('JupSOL');
    expect(pos.collateral[0].amount).toBeCloseTo(57543.3696);
    expect(pos.collateral[0].price).toBeCloseTo(80.71);
    expect(pos.collateral[0].liquidationThreshold).toBeCloseTo(0.6);
    expect(pos.collateral[0].supplyApy).toBeCloseTo(0.07);

    // Borrows
    expect(pos.borrows).toHaveLength(1);
    expect(pos.borrows[0].symbol).toBe('PYUSD');
    expect(pos.borrows[0].amount).toBeCloseTo(2042156.91);
    expect(pos.borrows[0].borrowApy).toBeCloseTo(0.08);

    // Debt value = tokenValue * borrowFactor = 2041983.60 * 1.0
    expect(pos.debtValue).toBeCloseTo(2041983.6);
  });

  it('falls back to zero APY when reserve metrics are falsy or the token is absent', async () => {
    const fetchMock = vi.fn();

    // Portfolio response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lending: [{ address: 'OBL1', marketAddress: 'MKT1' }] }),
    });

    // Market metadata
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Main Market' }),
    });

    // Reserve metrics with falsy APYs -> Number(x) || 0 fallback, and a token
    // that none of the loan's assets reference -> apyMap.get(...) ?? 0 fallback.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { liquidityToken: 'OTHER', reserve: 'RSV_OTHER', supplyApy: 0, borrowApy: 0 },
      ],
    });

    // Loan detail referencing assets absent from the reserve metrics
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockKaminoLoanDetail,
    });

    vi.stubGlobal('fetch', fetchMock);

    const { loadKaminoPositions } = await import('../src/lib/clients/kamino');
    const positions = await loadKaminoPositions('FallbackWallet');

    expect(positions).toHaveLength(1);
    expect(positions[0].collateral[0].supplyApy).toBe(0);
    expect(positions[0].borrows[0].borrowApy).toBe(0);
  });

  it('returns empty array when portfolio has no lending positions', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lending: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadKaminoPositions } = await import('../src/lib/clients/kamino');
    const positions = await loadKaminoPositions('EmptyWallet');
    expect(positions).toHaveLength(0);
  });

  it('returns empty array when portfolio response has no lending key', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadKaminoPositions } = await import('../src/lib/clients/kamino');
    const positions = await loadKaminoPositions('NoLendingWallet');
    expect(positions).toHaveLength(0);
  });

  it('throws on non-ok HTTP response', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadKaminoPositions } = await import('../src/lib/clients/kamino');
    await expect(loadKaminoPositions('BadWallet')).rejects.toThrow('Kamino API error');
  });

  it('reuses market name from cache when multiple loans have the same marketAddress', async () => {
    const fetchMock = vi.fn();

    // Portfolio response with two loans on the same market
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lending: [
          { address: 'OBL1', marketAddress: 'MKT1' },
          { address: 'OBL2', marketAddress: 'MKT1' },
        ],
      }),
    });

    // Market metadata - should only be called ONCE
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'Main Market' }),
    });

    // Reserve metrics - also cached per market, called ONCE
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockKaminoReserveMetrics,
    });

    // Loan detail for OBL1
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockKaminoLoanDetail,
    });

    // Loan detail for OBL2
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockKaminoLoanDetail,
    });

    vi.stubGlobal('fetch', fetchMock);

    const { loadKaminoPositions } = await import('../src/lib/clients/kamino');
    const positions = await loadKaminoPositions('DoubleWallet');

    expect(positions).toHaveLength(2);
    expect(positions[0].marketName).toBe('Main Market');
    expect(positions[1].marketName).toBe('Main Market');
    // portfolio + market metadata + reserve metrics + 2 loan details
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

// --------------------------------------------------------------------------- //
// Test Kamino reserve resolver
// --------------------------------------------------------------------------- //

describe('Kamino reserve resolution', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a reserve from the market catalog', async () => {
    const fetchMock = vi.fn();

    // Reserve list
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { liquidityToken: 'SOL', reserve: 'SOL_RSV' },
        { liquidityToken: 'USDC', reserve: 'USDC_RSV' },
      ],
    });

    // Reserve history
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        history: [
          {
            metrics: {
              assetPriceUSD: '100.0',
              borrowFactor: '120.0',
              liquidationThreshold: '0.8',
            },
          },
        ],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { resolveKaminoReserve } = await import('../src/lib/clients/kamino');
    const info = await resolveKaminoReserve('MKT1', 'sol');

    expect(info).not.toBeNull();
    expect(info!.symbol).toBe('SOL');
    expect(info!.price).toBe(100.0);
    expect(info!.liquidationThreshold).toBe(0.8);
    expect(info!.borrowFactor).toBe(1.2);
  });

  it('returns null when the symbol is not found', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ liquidityToken: 'SOL', reserve: 'SOL_RSV' }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resolveKaminoReserve } = await import('../src/lib/clients/kamino');
    const info = await resolveKaminoReserve('MKT1', 'BONK');
    expect(info).toBeNull();
  });

  it('returns null when history is empty', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ liquidityToken: 'SOL', reserve: 'SOL_RSV' }],
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ history: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resolveKaminoReserve } = await import('../src/lib/clients/kamino');
    const info = await resolveKaminoReserve('MKT1', 'SOL');
    expect(info).toBeNull();
  });

  it('returns null when metrics are missing from history point', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ liquidityToken: 'SOL', reserve: 'SOL_RSV' }],
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ history: [{}] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resolveKaminoReserve } = await import('../src/lib/clients/kamino');
    const info = await resolveKaminoReserve('MKT1', 'SOL');
    expect(info).toBeNull();
  });

  it('returns null when history key is missing entirely', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ liquidityToken: 'SOL', reserve: 'SOL_RSV' }],
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resolveKaminoReserve } = await import('../src/lib/clients/kamino');
    const info = await resolveKaminoReserve('MKT1', 'SOL');
    expect(info).toBeNull();
  });

  it('resolves a reserve with empty metrics using fallbacks', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ liquidityToken: 'SOL', reserve: 'SOL_RSV' }],
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        history: [{ metrics: {} }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resolveKaminoReserve } = await import('../src/lib/clients/kamino');
    const info = await resolveKaminoReserve('MKT1', 'SOL');
    expect(info).not.toBeNull();
    expect(info!.price).toBe(0);
    expect(info!.liquidationThreshold).toBe(0);
    expect(info!.borrowFactor).toBe(1.0);
  });
});

// --------------------------------------------------------------------------- //
// Test Aave V3 client
// --------------------------------------------------------------------------- //

describe('Aave V3 client integration', () => {
  let currentTime = 1000000;

  beforeEach(() => {
    vi.restoreAllMocks();
    currentTime += 100000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);
  });

  it('returns empty array when markets query returns empty list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markets: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadAavePositions } = await import('../src/lib/clients/aave');
    const result = await loadAavePositions('0xUserEmpty', [1]);
    expect(result).toEqual([]);
  });

  it('loads and parses Aave positions correctly', async () => {
    const fetchMock = vi.fn();

    // 1. Markets response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          markets: [
            {
              address: '0xMKT1',
              name: 'Ethereum Main Market',
              chain: { chainId: 1 },
              userState: { healthFactor: '2.0', eModeEnabled: false },
              reserves: [
                {
                  underlyingToken: { symbol: 'USDC', address: '0xUSDC' },
                  supplyInfo: { liquidationThreshold: { value: '0.8' } },
                  userState: null,
                  usdExchangeRate: '1.0',
                },
                {
                  underlyingToken: { symbol: 'USDT', address: '0xUSDT' },
                  supplyInfo: { liquidationThreshold: { value: '0.85' } },
                  userState: null,
                  usdExchangeRate: '1.0',
                },
              ],
            },
          ],
        },
      }),
    });

    // 2. Positions response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          userSupplies: [
            {
              market: { address: '0xMKT1', chain: { chainId: 1 } },
              currency: { symbol: 'USDC', address: '0xUSDC' },
              balance: { amount: { value: '1000' }, usdPerToken: '1.0', usd: '1000' },
              apy: { value: '0.03' },
              isCollateral: true,
            },
            {
              market: { address: '0xMKT1', chain: { chainId: 1 } },
              currency: { symbol: 'USDT', address: '0xUSDT' },
              balance: { amount: { value: '500' }, usdPerToken: '1.0', usd: '500' },
              apy: { value: '0.04' },
              isCollateral: false,
            },
            {
              market: { address: '0xMKT1', chain: { chainId: 1 } },
              currency: { symbol: 'DAI', address: '0xDAI' },
              balance: { amount: { value: '200' }, usdPerToken: '1.0', usd: '200' },
              apy: { value: '0.025' },
              isCollateral: true, // Not in reserves, will hit ?? 0 fallback
            },
          ],
          userBorrows: [
            {
              market: { address: '0xMKT1', chain: { chainId: 1 } },
              currency: { symbol: 'USDT', address: '0xUSDT' },
              debt: { amount: { value: '300' }, usdPerToken: '1.0', usd: '300' },
              apy: { value: '0.06' },
            },
          ],
        },
      }),
    });

    // 3. User-state response (queried per chain for net APY / health factor)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          markets: [
            {
              address: '0xMKT1',
              userState: { netAPY: { value: '-0.015' }, healthFactor: '1.85' },
            },
          ],
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { loadAavePositions } = await import('../src/lib/clients/aave');
    const positions = await loadAavePositions('0xUserCorrect', [1]);

    expect(positions).toHaveLength(1);
    const pos = positions[0];
    expect(pos.marketName).toBe('Ethereum Main Market');
    expect(pos.marketId).toBe('1:0xMKT1');
    expect(pos.address).toBe('0xMKT1');

    // Net APY and health factor come straight from Aave's userState.
    expect(pos.netApy).toBe(-0.015);
    expect(pos.healthFactor).toBe(1.85);

    expect(pos.collateral).toHaveLength(2);
    expect(pos.collateral[0].symbol).toBe('USDC');
    expect(pos.collateral[0].amount).toBe(1000);
    expect(pos.collateral[0].price).toBe(1.0);
    expect(pos.collateral[0].liquidationThreshold).toBe(0.8);
    expect(pos.collateral[0].supplyApy).toBe(0.03);

    expect(pos.collateral[1].symbol).toBe('DAI');
    expect(pos.collateral[1].amount).toBe(200);
    expect(pos.collateral[1].price).toBe(1.0);
    expect(pos.collateral[1].liquidationThreshold).toBe(0);
    expect(pos.collateral[1].supplyApy).toBe(0.025);

    expect(pos.borrows).toHaveLength(1);
    expect(pos.borrows[0].symbol).toBe('USDT');
    expect(pos.borrows[0].amount).toBe(300);
    expect(pos.borrows[0].price).toBe(1.0);
    expect(pos.borrows[0].borrowFactor).toBe(1.0);
    expect(pos.borrows[0].borrowApy).toBe(0.06);
    expect(pos.debtValue).toBe(300);
  });

  it('falls back to null net APY and health factor when userState is absent', async () => {
    const fetchMock = vi.fn();

    // Markets response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          markets: [
            {
              address: '0xMKT1',
              name: 'Ethereum Main Market',
              chain: { chainId: 1 },
              userState: null,
              reserves: [
                {
                  underlyingToken: { symbol: 'USDC', address: '0xUSDC' },
                  supplyInfo: { liquidationThreshold: { value: '0.8' } },
                  userState: null,
                  usdExchangeRate: '1.0',
                },
              ],
            },
          ],
        },
      }),
    });

    // Positions response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          userSupplies: [
            {
              market: { address: '0xMKT1', chain: { chainId: 1 } },
              currency: { symbol: 'USDC', address: '0xUSDC' },
              balance: { amount: { value: '1000' }, usdPerToken: '1.0', usd: '1000' },
              apy: { value: '0.03' },
              isCollateral: true,
            },
          ],
          userBorrows: [],
        },
      }),
    });

    // User-state response with the market present but no userState payload
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { markets: [{ address: '0xMKT1', userState: null }] },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const { loadAavePositions } = await import('../src/lib/clients/aave');
    const positions = await loadAavePositions('0xUserNullState', [1]);

    expect(positions).toHaveLength(1);
    expect(positions[0].netApy).toBeNull();
    expect(positions[0].healthFactor).toBeNull();
  });

  it('skips positions that have no collateral and no debt', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          markets: [
            {
              address: '0xMKT1',
              name: 'Empty Market',
              chain: { chainId: 1 },
              reserves: [],
            },
          ],
        },
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          userSupplies: [],
          userBorrows: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadAavePositions } = await import('../src/lib/clients/aave');
    const positions = await loadAavePositions('0xUserSkips', [1]);
    expect(positions).toHaveLength(0);
  });

  it('resolves reserve info successfully with eMode configuration', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          markets: [
            {
              address: '0xMKT1',
              reserves: [
                {
                  underlyingToken: { symbol: 'USDC', address: '0xUSDC' },
                  supplyInfo: { liquidationThreshold: { value: '0.8' } },
                  userState: { emode: { liquidationThreshold: { value: '0.95' } } },
                  usdExchangeRate: '1.02',
                },
              ],
            },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resolveAaveReserve } = await import('../src/lib/clients/aave');
    const reserve = await resolveAaveReserve('0xUserEmode', '1:0xMKT1', 'USDC');
    expect(reserve).not.toBeNull();
    expect(reserve!.symbol).toBe('USDC');
    expect(reserve!.price).toBe(1.02);
    expect(reserve!.liquidationThreshold).toBe(0.95);
    expect(reserve!.borrowFactor).toBe(1.0);
  });

  it('resolves reserve price to 0 when usdExchangeRate is falsy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          markets: [
            {
              address: '0xMKT1',
              reserves: [
                {
                  underlyingToken: { symbol: 'USDC', address: '0xUSDC' },
                  supplyInfo: { liquidationThreshold: { value: '0.8' } },
                  usdExchangeRate: '',
                },
              ],
            },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resolveAaveReserve } = await import('../src/lib/clients/aave');
    const reserve = await resolveAaveReserve('0xUserFalsy', '1:0xMKT1', 'USDC');
    expect(reserve).not.toBeNull();
    expect(reserve!.price).toBe(0);
  });

  it('returns null when reserve symbol or market does not exist', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          markets: [
            {
              address: '0xMKT1',
              reserves: [
                {
                  underlyingToken: { symbol: 'USDC', address: '0xUSDC' },
                  supplyInfo: { liquidationThreshold: { value: '0.8' } },
                  usdExchangeRate: '1.0',
                },
              ],
            },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resolveAaveReserve } = await import('../src/lib/clients/aave');
    
    // Symbol mismatch
    const res1 = await resolveAaveReserve('0xUserNull', '1:0xMKT1', 'USDT');
    expect(res1).toBeNull();

    // Market mismatch
    const res2 = await resolveAaveReserve('0xUserNull', '1:0xMKT2', 'USDC');
    expect(res2).toBeNull();
  });

  it('returns null on invalid marketId in resolveAaveReserve', async () => {
    const { resolveAaveReserve } = await import('../src/lib/clients/aave');
    
    expect(await resolveAaveReserve('0xUser', 'invalidId', 'USDC')).toBeNull();
    expect(await resolveAaveReserve('0xUser', 'abc:0xMKT1', 'USDC')).toBeNull();
  });

  it('throws an error when Aave API response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadAavePositions } = await import('../src/lib/clients/aave');
    await expect(loadAavePositions('0xUserError', [1])).rejects.toThrow('Aave API error: 500');
  });

  it('throws an error when Aave response contains GraphQL errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: [{ message: 'GraphQL syntax error' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadAavePositions } = await import('../src/lib/clients/aave');
    await expect(loadAavePositions('0xUserGraphqlError', [1])).rejects.toThrow('Aave GraphQL error');
  });

  it('uses caching for Aave GraphQL responses and respects TTL', async () => {
    let now = 2000000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { markets: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadAavePositions } = await import('../src/lib/clients/aave');
    
    // First call (cache miss)
    await loadAavePositions('0xUserCache', [1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call (cache hit)
    now += 5000; // 5 seconds later
    await loadAavePositions('0xUserCache', [1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Third call after TTL (cache expiry)
    now += 11000; // 16 seconds later total
    await loadAavePositions('0xUserCache', [1]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
