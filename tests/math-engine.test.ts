import { describe, it, expect } from 'vitest';
import {
  Collateral,
  Borrow,
  Position,
  singleAssetLevels,
  crashScenario,
  CrashStatus,
  AmountChange,
  applyOverrides,
} from '../src/lib/math-engine';

describe('DeFi Math Engine', () => {
  // Test basic properties
  describe('Collateral & Borrow Value getters', () => {
    it('computes correct value for Collateral', () => {
      const c = new Collateral('SOL', 10, 100, 0.8);
      expect(c.value).toBe(1000);
      expect(c.weightedValue).toBe(800);
      expect(c.isStable).toBe(false);
    });

    it('identifies stable symbols correctly', () => {
      const usdc = new Collateral('USDC', 1000, 1.0, 0.9);
      expect(usdc.isStable).toBe(true);
      const random = new Collateral('RANDOM_STABLE_TEST', 10, 10, 0.5);
      expect(random.isStable).toBe(false);
    });

    it('computes correct value for Borrow', () => {
      const b = new Borrow('USDC', 500, 1.0, 1.0);
      expect(b.value).toBe(500);
      expect(b.isStable).toBe(true);
    });
  });

  describe('Position getters', () => {
    const c1 = new Collateral('SOL', 10, 100, 0.8); // value: 1000, weighted: 800
    const c2 = new Collateral('USDC', 200, 1.0, 0.9); // value: 200, weighted: 180
    const b = new Borrow('USDC', 500, 1.0, 1.0); // value: 500

    it('computes basic position stats correctly', () => {
      const pos = new Position('Main', '0xabc', [c1, c2], [b], 500);

      expect(pos.hasDebt).toBe(true);
      expect(pos.depositValue).toBe(1200);
      expect(pos.liquidationLimit).toBe(980);
      expect(pos.netValue).toBe(700);
      expect(pos.currentLtv).toBe(500 / 1200);
      expect(pos.liquidationLtv).toBe(980 / 1200);
      expect(pos.healthFactor).toBe(980 / 500);
      expect(pos.dropToLiquidation).toBeCloseTo(1 - 500 / 980);
    });

    it('handles zero values correctly (edge cases)', () => {
      const noDebtPos = new Position('Main', '0xabc', [c1], [], 0);
      expect(noDebtPos.hasDebt).toBe(false);
      expect(noDebtPos.currentLtv).toBe(0);
      expect(noDebtPos.liquidationLtv).toBe(800 / 1000);
      expect(noDebtPos.healthFactor).toBe(Infinity);
      expect(noDebtPos.dropToLiquidation).toBe(1.0);

      const noCollateralPos = new Position('Main', '0xabc', [], [b], 500);
      expect(noCollateralPos.depositValue).toBe(0);
      expect(noCollateralPos.liquidationLimit).toBe(0);
      expect(noCollateralPos.currentLtv).toBe(0);
      expect(noCollateralPos.liquidationLtv).toBe(0);
      expect(noCollateralPos.healthFactor).toBe(0);
      expect(noCollateralPos.dropToLiquidation).toBe(0.0);
    });
  });

  // Test single asset drops
  describe('singleAssetLevels', () => {
    it('computes single asset liquidation price correctly', () => {
      // Limit = 800 (SOL) + 180 (USDC) = 980. Debt = 500.
      // If SOL alone falls: held = 180.
      // We need SOL weighted value to drop to: Debt - held = 500 - 180 = 320.
      // SOL amount * threshold * price = 320 -> 10 * 0.8 * price = 320 -> 8 * price = 320 -> price = 40.
      const c1 = new Collateral('SOL', 10, 100, 0.8);
      const c2 = new Collateral('USDC', 200, 1.0, 0.9);
      const b = new Borrow('USDC', 500, 1.0, 1.0);
      const pos = new Position('Main', '0xabc', [c1, c2], [b], 500);

      const levels = singleAssetLevels(pos);
      expect(levels).toHaveLength(2);

      const solLevel = levels.find((l) => l.collateral.symbol === 'SOL')!;
      expect(solLevel.price).toBe(40);
      expect(solLevel.buffer).toBeCloseTo((100 - 40) / 100);

      // USDC alone falls: held = 800.
      // Since 800 is already > 500 (debt), USDC can fall to $0 and position survives.
      const usdcLevel = levels.find((l) => l.collateral.symbol === 'USDC')!;
      expect(usdcLevel.price).toBeNull();
      expect(usdcLevel.buffer).toBeNull();
    });

    it('handles zero thresholds without crash', () => {
      const c1 = new Collateral('SOL', 10, 100, 0.0);
      const b = new Borrow('USDC', 100, 1.0, 1.0);
      const pos = new Position('Main', '0xabc', [c1], [b], 100);

      const levels = singleAssetLevels(pos);
      expect(levels[0].price).toBeNull();
    });
  });

  // Test crash scenarios
  describe('crashScenario', () => {
    it('identifies volatile debt', () => {
      const c = new Collateral('USDC', 1000, 1.0, 0.9);
      const b = new Borrow('SOL', 5, 100, 1.0); // Volatile borrow!
      const pos = new Position('Main', '0xabc', [c], [b], 500);

      const scenario = crashScenario(pos);
      expect(scenario.status).toBe(CrashStatus.VOLATILE_DEBT);
      expect(scenario.drop).toBeNull();
      expect(scenario.prices).toBeNull();
    });

    it('returns SAFE if stable capacity covers the debt', () => {
      const c1 = new Collateral('USDC', 1000, 1.0, 0.9); // weighted: 900
      const c2 = new Collateral('SOL', 5, 100, 0.8); // weighted: 400
      const b = new Borrow('USDT', 500, 1.0, 1.0); // Stable borrow, value 500
      const pos = new Position('Main', '0xabc', [c1, c2], [b], 500);

      const scenario = crashScenario(pos);
      expect(scenario.status).toBe(CrashStatus.SAFE);
      expect(scenario.drop).toBeNull();
    });

    it('returns EXCEEDED if no volatile capacity is available to cover remaining debt', () => {
      const c1 = new Collateral('USDC', 500, 1.0, 0.9); // weighted: 450
      const b = new Borrow('USDT', 500, 1.0, 1.0); // Stable borrow, value 500
      // Stable capacity (450) < Debt (500), but no volatile assets are deposited!
      const pos = new Position('Main', '0xabc', [c1], [b], 500);

      const scenario = crashScenario(pos);
      expect(scenario.status).toBe(CrashStatus.EXCEEDED);
      expect(scenario.drop).toBeNull();
    });

    it('returns AT_RISK if position is already at or past liquidation threshold', () => {
      const c1 = new Collateral('USDC', 200, 1.0, 0.9); // weighted: 180
      const c2 = new Collateral('SOL', 5, 100, 0.8); // weighted: 400
      const b = new Borrow('USDT', 600, 1.0, 1.0); // Stable borrow, value 600
      // Total limit = 580. Debt = 600. Already past liquidation threshold.
      const pos = new Position('Main', '0xabc', [c1, c2], [b], 600);

      const scenario = crashScenario(pos);
      expect(scenario.status).toBe(CrashStatus.AT_RISK);
    });

    it('returns TRIGGERABLE with correct drop percentage and crash prices', () => {
      const c1 = new Collateral('USDC', 200, 1.0, 0.9); // stable capacity = 180
      const c2 = new Collateral('SOL', 10, 100, 0.8); // volatile capacity = 800
      const b = new Borrow('USDT', 500, 1.0, 1.0); // Stable borrow, value 500
      const pos = new Position('Main', '0xabc', [c1, c2], [b], 500);

      // remaining volatile ratio = (500 - 180) / 800 = 320 / 800 = 0.4
      // drop = 1 - 0.4 = 0.6 (60%)
      const scenario = crashScenario(pos);
      expect(scenario.status).toBe(CrashStatus.TRIGGERABLE);
      expect(scenario.drop).toBeCloseTo(0.6);

      const stablePrice = scenario.prices?.find(([c]) => c.symbol === 'USDC')?.[1];
      const volatilePrice = scenario.prices?.find(([c]) => c.symbol === 'SOL')?.[1];

      expect(stablePrice).toBe(1.0); // held peg
      expect(volatilePrice).toBe(40); // 100 * 0.4
    });
  });

  // Test amount change and simulation overrides
  describe('AmountChange', () => {
    it('applies absolute changes correctly', () => {
      const change = new AmountChange(50, false);
      expect(change.appliedTo(10)).toBe(50);
      expect(change.appliedTo(100)).toBe(50);
    });

    it('applies relative delta changes correctly', () => {
      const add = new AmountChange(10, true);
      expect(add.appliedTo(100)).toBe(110);

      const subtract = new AmountChange(-30, true);
      expect(subtract.appliedTo(100)).toBe(70);
    });

    it('floors relative adjustments at 0', () => {
      const subtractExcess = new AmountChange(-150, true);
      expect(subtractExcess.appliedTo(100)).toBe(0);

      const absoluteNegative = new AmountChange(-50, false);
      expect(absoluteNegative.appliedTo(100)).toBe(0); // Floor absolute targets at 0 as well
    });
  });

  describe('applyOverrides', () => {
    it('applies price overrides', () => {
      const c = new Collateral('SOL', 10, 100, 0.8);
      const b = new Borrow('USDC', 500, 1.0, 1.0);
      const pos = new Position('Main', '0xabc', [c], [b], 500);

      const sim = applyOverrides(pos, {
        prices: { SOL: 150, USDC: 1.05 },
      });

      expect(sim.collateral[0].price).toBe(150);
      expect(sim.borrows[0].price).toBe(1.05);
      // Verify simulated debt is recalculated with new price
      // original raw borrows = 500 * 1 = 500.
      // factor = 500 / 500 = 1.0.
      // new raw borrows = 500 * 1.05 = 525.
      // debtValue = 1.0 * 525 = 525.
      expect(sim.debtValue).toBe(525);
    });

    it('applies collateral and borrow amount overrides', () => {
      const c = new Collateral('SOL', 10, 100, 0.8);
      const b = new Borrow('USDC', 500, 1.0, 1.0);
      const pos = new Position('Main', '0xabc', [c], [b], 500);

      const sim = applyOverrides(pos, {
        collateralAmounts: { SOL: new AmountChange(5, true) },
        borrowAmounts: { USDC: new AmountChange(200, false) },
      });

      expect(sim.collateral[0].amount).toBe(15);
      expect(sim.borrows[0].amount).toBe(200);
      expect(sim.debtValue).toBe(200);
    });

    it('adds new collateral and borrows using resolved configurations', () => {
      const c = new Collateral('SOL', 10, 100, 0.8);
      const b = new Borrow('USDC', 500, 1.0, 1.0);
      const pos = new Position('Main', '0xabc', [c], [b], 500);

      const addedC = new Collateral('JupSOL', 20, 110, 0.7);
      const addedB = new Borrow('USDT', 300, 1.0, 1.05); // borrow factor 1.05

      const sim = applyOverrides(pos, {
        addCollateral: [addedC],
        addBorrows: [addedB],
      });

      expect(sim.collateral).toHaveLength(2);
      expect(sim.collateral[1].symbol).toBe('JupSOL');
      expect(sim.collateral[1].amount).toBe(20);
      expect(sim.collateral[1].price).toBe(110); // defaults to reserve price

      expect(sim.borrows).toHaveLength(2);
      expect(sim.borrows[1].symbol).toBe('USDT');
      expect(sim.borrows[1].amount).toBe(300);
      expect(sim.borrows[1].price).toBe(1.0); // defaults to reserve price

      // Recalculating debt:
      // existing debt = factor * 500 = 500.
      // added debt = 300 * 1.0 * 1.05 = 315.
      // total debt = 815.
      expect(sim.debtValue).toBe(815);
    });

    it('adds new collateral and borrows with custom price overrides', () => {
      const c = new Collateral('SOL', 10, 100, 0.8);
      const b = new Borrow('USDC', 500, 1.0, 1.0);
      const pos = new Position('Main', '0xabc', [c], [b], 500);

      const addedC = new Collateral('JupSOL', 20, 110, 0.7);
      const addedB = new Borrow('USDT', 300, 1.0, 1.05);

      const sim = applyOverrides(pos, {
        addCollateral: [addedC],
        addBorrows: [addedB],
        prices: { JUPSOL: 120, USDT: 1.02 },
      });

      expect(sim.collateral[1].price).toBe(120); // overridden price
      expect(sim.borrows[1].price).toBe(1.02); // overridden price

      // Recalculating debt:
      // existing debt = factor * 500 = 500.
      // added debt = 300 * 1.02 * 1.05 = 321.3.
      // total debt = 821.3.
      expect(sim.debtValue).toBeCloseTo(821.3);
    });

    it('recalculates debt scaling correctly when original borrow list is empty', () => {
      const c = new Collateral('SOL', 10, 100, 0.8);
      const pos = new Position('Main', '0xabc', [c], [], 0);

      const addedB = new Borrow('USDT', 300, 1.0, 1.05);

      const sim = applyOverrides(pos, {
        addBorrows: [addedB],
      });

      // factor defaults to 1.0.
      // existing debt = 1.0 * 0 = 0.
      // added debt = 300 * 1.0 * 1.05 = 315.
      expect(sim.debtValue).toBe(315);
    });
  });
});
