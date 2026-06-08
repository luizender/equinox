/**
 * Wallet address validator and protocol detector.
 */

const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export interface ValidationResult {
  isValid: boolean;
  protocol: 'kamino' | 'aave' | null;
  error?: string;
}

/**
 * Validate a wallet address and detect its protocol.
 * EVM addresses start with 0x followed by 40 hex characters.
 * Solana addresses are 32-44 character base58 strings.
 */
export function validateAddress(address: string): ValidationResult {
  const trimmed = address.trim();
  if (!trimmed) {
    return { isValid: false, protocol: null, error: 'Address cannot be empty' };
  }

  // EVM detection: must start with 0x
  if (trimmed.startsWith('0x')) {
    if (EVM_ADDRESS_REGEX.test(trimmed)) {
      return { isValid: true, protocol: 'aave' };
    }
    return {
      isValid: false,
      protocol: 'aave',
      error: 'Invalid EVM address (expected 0x followed by 40 hex characters)',
    };
  }

  // Solana detection: base58 alphabet, 32-44 chars
  if (SOLANA_ADDRESS_REGEX.test(trimmed)) {
    return { isValid: true, protocol: 'kamino' };
  }

  return {
    isValid: false,
    protocol: null,
    error: 'Invalid wallet address format (unrecognized Solana or EVM address)',
  };
}
