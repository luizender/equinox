import { STABLE_SYMBOLS } from './config';

/**
 * A deposited asset backing the loan.
 */
export class Collateral {
  readonly symbol: string;
  readonly amount: number;
  readonly price: number;
  readonly liquidationThreshold: number;
  readonly supplyApy: number;

  constructor(
    symbol: string,
    amount: number,
    price: number,
    liquidationThreshold: number,
    supplyApy: number = 0
  ) {
    this.symbol = symbol;
    this.amount = amount;
    this.price = price;
    this.liquidationThreshold = liquidationThreshold;
    this.supplyApy = supplyApy;
  }

  /**
   * USD value of the deposit (amount * price).
   */
  get value(): number {
    return this.amount * this.price;
  }

  /**
   * The slice of this collateral that counts toward the liquidation limit.
   */
  get weightedValue(): number {
    return this.value * this.liquidationThreshold;
  }

  /**
   * Whether the asset is treated as a peg-holding stablecoin.
   */
  get isStable(): boolean {
    return STABLE_SYMBOLS.has(this.symbol.toUpperCase());
  }
}

/**
 * A borrowed asset — the position's debt.
 */
export class Borrow {
  readonly symbol: string;
  readonly amount: number;
  readonly price: number;
  readonly borrowFactor: number;
  readonly borrowApy: number;

  constructor(
    symbol: string,
    amount: number,
    price: number,
    borrowFactor: number = 1.0,
    borrowApy: number = 0
  ) {
    this.symbol = symbol;
    this.amount = amount;
    this.price = price;
    this.borrowFactor = borrowFactor;
    this.borrowApy = borrowApy;
  }

  /**
   * USD value of the borrow (amount * price).
   */
  get value(): number {
    return this.amount * this.price;
  }

  /**
   * Whether the borrowed asset is a peg-holding stablecoin.
   */
  get isStable(): boolean {
    return STABLE_SYMBOLS.has(this.symbol.toUpperCase());
  }
}

/**
 * A wallet's obligation in one market: its collateral, debt, and health.
 */
export class Position {
  readonly marketName: string;
  readonly address: string;
  readonly collateral: Collateral[];
  readonly borrows: Borrow[];
  readonly debtValue: number; // Kamino's adjusted debt value, or sum of Aave borrows
  readonly marketId: string;
  // Protocol-reported live figures, when available (Aave). Null on simulated
  // positions and on sources that don't report them, so callers fall back to
  // the computed values.
  readonly reportedNetApy: number | null;
  readonly reportedHealthFactor: number | null;

  constructor(
    marketName: string,
    address: string,
    collateral: Collateral[],
    borrows: Borrow[],
    debtValue: number,
    marketId: string = '',
    reportedNetApy: number | null = null,
    reportedHealthFactor: number | null = null
  ) {
    this.marketName = marketName;
    this.address = address;
    this.collateral = collateral;
    this.borrows = borrows;
    this.debtValue = debtValue;
    this.marketId = marketId;
    this.reportedNetApy = reportedNetApy;
    this.reportedHealthFactor = reportedHealthFactor;
  }

  /**
   * Whether the position carries debt (and so can be liquidated).
   */
  get hasDebt(): boolean {
    return this.debtValue > 0;
  }

  /**
   * Total USD value of all collateral.
   */
  get depositValue(): number {
    return this.collateral.reduce((sum, c) => sum + c.value, 0);
  }

  /**
   * Debt value at which the position becomes liquidatable.
   */
  get liquidationLimit(): number {
    return this.collateral.reduce((sum, c) => sum + c.weightedValue, 0);
  }

  /**
   * The position's equity: collateral value minus debt.
   */
  get netValue(): number {
    return this.depositValue - this.debtValue;
  }

  /**
   * Current loan-to-value ratio (debt ÷ deposits).
   */
  get currentLtv(): number {
    return this.depositValue ? this.debtValue / this.depositValue : 0.0;
  }

  /**
   * Weighted-average liquidation threshold (limit ÷ deposits).
   */
  get liquidationLtv(): number {
    return this.depositValue ? this.liquidationLimit / this.depositValue : 0.0;
  }

  /**
   * Liquidation limit ÷ debt; the position is liquidated below 1.0.
   */
  get healthFactor(): number {
    return this.debtValue ? this.liquidationLimit / this.debtValue : Infinity;
  }

  /**
   * Fraction every collateral can fall together before liquidation.
   */
  get dropToLiquidation(): number {
    if (!this.liquidationLimit) {
      return 0.0;
    }
    return Math.max(0.0, 1 - this.debtValue / this.liquidationLimit);
  }
}

/**
 * Liquidation price of one collateral if only it moves, others held.
 */
export interface LiquidationLevel {
  collateral: Collateral;
  price: number | null; // null => the position survives even at $0
  buffer: number | null; // Fractional drop from the current price down to the liquidation price
}

/**
 * For each collateral: the price at which the position is liquidated if that
 * asset alone falls and the others hold their current value.
 */
export function singleAssetLevels(position: Position): LiquidationLevel[] {
  const levels: LiquidationLevel[] = [];
  for (const c of position.collateral) {
    const held = position.liquidationLimit - c.weightedValue;
    const denominator = c.amount * c.liquidationThreshold;
    const price = denominator > 0 ? (position.debtValue - held) / denominator : 0.0;
    const resolvedPrice = price > 0 ? price : null;
    const buffer =
      resolvedPrice !== null && c.price > 0 ? (c.price - resolvedPrice) / c.price : null;
    levels.push({ collateral: c, price: resolvedPrice, buffer });
  }
  return levels;
}

/**
 * Possible outcomes of the market-crash scenario.
 */
export enum CrashStatus {
  SAFE = 'safe', // stable collateral alone covers the debt
  EXCEEDED = 'exceeded', // debt exceeds stable capacity and there are no volatile assets to absorb it
  AT_RISK = 'at_risk', // already at or past the liquidation threshold
  TRIGGERABLE = 'triggerable', // a finite volatile drop triggers liquidation
  VOLATILE_DEBT = 'volatile_debt', // debt itself is volatile; a uniform crash is not meaningful
}

/**
 * The outcome of a market crash for a position, with per-asset prices.
 */
export interface CrashScenario {
  status: CrashStatus;
  drop: number | null; // volatile drop fraction that triggers liquidation
  prices: Array<[Collateral, number]> | null; // per-asset price at that drop
}

/**
 * Model a market crash where volatile collateral falls together while stable
 * collateral holds its peg.
 */
export function crashScenario(position: Position): CrashScenario {
  if (position.borrows.some(b => !b.isStable)) {
    // A uniform collateral crash would also move volatile debt, so holding the
    // debt fixed (as this model does) would be misleading. Defer to `simulate`.
    return { status: CrashStatus.VOLATILE_DEBT, drop: null, prices: null };
  }

  const stableCapacity = position.collateral
    .filter(c => c.isStable)
    .reduce((sum, c) => sum + c.weightedValue, 0);

  const volatileCapacity = position.collateral
    .filter(c => !c.isStable)
    .reduce((sum, c) => sum + c.weightedValue, 0);

  const debt = position.debtValue;

  if (debt <= stableCapacity) {
    return { status: CrashStatus.SAFE, drop: null, prices: null };
  }
  if (volatileCapacity <= 0) {
    return { status: CrashStatus.EXCEEDED, drop: null, prices: null };
  }

  const remaining = (debt - stableCapacity) / volatileCapacity;
  if (remaining >= 1.0) {
    return { status: CrashStatus.AT_RISK, drop: null, prices: null };
  }

  const prices: Array<[Collateral, number]> = position.collateral.map(c => [
    c,
    c.isStable ? c.price : c.price * remaining,
  ]);

  return { status: CrashStatus.TRIGGERABLE, drop: 1 - remaining, prices };
}

/**
 * A simulated change to an asset's amount: an absolute target, or — when
 * `isDelta` — a signed adjustment added to the current amount (floored at 0).
 */
export class AmountChange {
  readonly value: number;
  readonly isDelta: boolean;

  constructor(value: number, isDelta: boolean) {
    this.value = value;
    this.isDelta = isDelta;
  }

  /**
   * The new amount after this change is applied to the current `amount`.
   */
  appliedTo(amount: number): number {
    return Math.max(0.0, this.isDelta ? amount + this.value : this.value);
  }
}

/**
 * A collection of overrides and additions to apply to a Position.
 */
export interface Changes {
  prices?: Record<string, number>;
  collateralAmounts?: Record<string, AmountChange>;
  borrowAmounts?: Record<string, AmountChange>;
  addCollateral?: Collateral[];
  addBorrows?: Borrow[];
}

/**
 * Return a copy of `position` with overrides and additions applied.
 */
export function applyOverrides(position: Position, changes: Changes): Position {
  const prices = changes.prices || {};
  const collateralAmounts = changes.collateralAmounts || {};
  const borrowAmounts = changes.borrowAmounts || {};
  const addCollateral = changes.addCollateral || [];
  const addBorrows = changes.addBorrows || [];

  const overrideCollateral = (c: Collateral): Collateral => {
    const sym = c.symbol.toUpperCase();
    const price = prices[sym] !== undefined ? prices[sym] : c.price;
    let amount = c.amount;
    if (collateralAmounts[sym] !== undefined) {
      amount = collateralAmounts[sym].appliedTo(amount);
    }
    return new Collateral(c.symbol, amount, price, c.liquidationThreshold, c.supplyApy);
  };

  const overrideBorrow = (b: Borrow): Borrow => {
    const sym = b.symbol.toUpperCase();
    const price = prices[sym] !== undefined ? prices[sym] : b.price;
    let amount = b.amount;
    if (borrowAmounts[sym] !== undefined) {
      amount = borrowAmounts[sym].appliedTo(amount);
    }
    return new Borrow(b.symbol, amount, price, b.borrowFactor, b.borrowApy);
  };

  // Apply overrides to existing collateral
  let collateral = position.collateral.map(overrideCollateral);
  // Append newly added collateral with amount + price overrides applied
  collateral = [...collateral, ...addCollateral.map(overrideCollateral)];

  // Apply overrides to existing borrows
  const existingBorrows = position.borrows.map(overrideBorrow);
  // Append newly added borrows with amount + price overrides applied
  const addedBorrows = addBorrows.map(overrideBorrow);
  const borrows = [...existingBorrows, ...addedBorrows];

  // Debt calculation
  const oldBorrowed = position.borrows.reduce((sum, b) => sum + b.value, 0);
  const factor = oldBorrowed > 0 ? position.debtValue / oldBorrowed : 1.0;

  const existingDebt = factor * existingBorrows.reduce((sum, b) => sum + b.value, 0);
  const addedDebt = addedBorrows.reduce((sum, b) => sum + b.value * b.borrowFactor, 0);
  const debtValue = existingDebt + addedDebt;

  return new Position(
    position.marketName,
    position.address,
    collateral,
    borrows,
    debtValue,
    position.marketId
  );
}
