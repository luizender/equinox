import { describe, it, expect } from 'vitest';
import { validateAddress } from '../src/lib/validation';

describe('validateAddress', () => {
  describe('empty / blank input', () => {
    it('rejects an empty string', () => {
      const result = validateAddress('');
      expect(result.isValid).toBe(false);
      expect(result.protocol).toBeNull();
      expect(result.error).toBe('Address cannot be empty');
    });

    it('rejects a whitespace-only string', () => {
      const result = validateAddress('   ');
      expect(result.isValid).toBe(false);
      expect(result.protocol).toBeNull();
      expect(result.error).toBe('Address cannot be empty');
    });
  });

  describe('EVM / Aave addresses', () => {
    it('accepts a valid EVM address (checksummed)', () => {
      const result = validateAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28');
      expect(result.isValid).toBe(true);
      expect(result.protocol).toBe('aave');
      expect(result.error).toBeUndefined();
    });

    it('accepts a valid EVM address (lowercase)', () => {
      const result = validateAddress('0x742d35cc6634c0532925a3b844bc9e7595f2bd28');
      expect(result.isValid).toBe(true);
      expect(result.protocol).toBe('aave');
    });

    it('rejects a 0x-prefixed address that is too short', () => {
      const result = validateAddress('0x742d35Cc6634');
      expect(result.isValid).toBe(false);
      expect(result.protocol).toBe('aave');
      expect(result.error).toContain('Invalid EVM address');
    });

    it('rejects a 0x-prefixed address that is too long', () => {
      const result = validateAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28FF');
      expect(result.isValid).toBe(false);
      expect(result.protocol).toBe('aave');
    });

    it('rejects a 0x-prefixed address with non-hex characters', () => {
      const result = validateAddress('0xGGGd35Cc6634C0532925a3b844Bc9e7595f2bD28');
      expect(result.isValid).toBe(false);
      expect(result.protocol).toBe('aave');
    });
  });

  describe('Solana / Kamino addresses', () => {
    it('accepts a valid Solana base58 public key', () => {
      const result = validateAddress('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
      expect(result.isValid).toBe(true);
      expect(result.protocol).toBe('kamino');
      expect(result.error).toBeUndefined();
    });

    it('accepts a short valid Solana address (32 chars)', () => {
      const result = validateAddress('11111111111111111111111111111111');
      expect(result.isValid).toBe(true);
      expect(result.protocol).toBe('kamino');
    });

    it('rejects an address with invalid base58 characters', () => {
      // '0' is not in base58 alphabet, but starts with a digit so it tries EVM path first
      // Actually 'O' (capital O) is not in base58
      const result = validateAddress('OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO');
      expect(result.isValid).toBe(false);
    });

    it('rejects a too-short address that does not match any pattern', () => {
      // 'abc' is only 3 chars, too short for Solana (32-44) and lacks 0x prefix
      const result = validateAddress('abc');
      expect(result.isValid).toBe(false);
      expect(result.protocol).toBeNull();
      expect(result.error).toContain('Invalid wallet address format');
    });
  });

  describe('hex-looking addresses without 0x prefix', () => {
    it('rejects a hex string without 0x prefix as unrecognized', () => {
      // '742d35Cc...' contains '0' which is not in base58, and has no 0x prefix
      const result = validateAddress('742d35Cc6634C0532925a3b844Bc9e7595f2bD28');
      expect(result.isValid).toBe(false);
      expect(result.protocol).toBeNull();
      expect(result.error).toContain('Invalid wallet address format');
    });
  });
});
