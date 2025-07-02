import type { Address, TypedData, TypedDataDomain } from 'viem';

// EIP-712 Domain for Clear Signing
export const DCA_DOMAIN: TypedDataDomain = {
  name: 'Flip The Stock Market - DCA',
  version: '1',
  chainId: 8453, // Base
  verifyingContract: '0x0000000000000000000000000000000000000000', // Placeholder
};

// EIP-712 Types for Complete DCA Setup (Order + Funding + Session Key)
export const COMPLETE_DCA_SETUP_TYPES = {
  CompleteDCASetup: [
    { name: 'user', type: 'address' },
    { name: 'smartWallet', type: 'address' },
    { name: 'fromToken', type: 'string' },
    { name: 'toToken', type: 'string' },
    { name: 'totalAmount', type: 'string' },
    { name: 'amountPerOrder', type: 'string' },
    { name: 'frequency', type: 'string' },
    { name: 'numberOfOrders', type: 'uint256' },
    { name: 'destinationWallet', type: 'address' },
    { name: 'platformFee', type: 'string' },
    { name: 'sessionPermissions', type: 'string' },
    { name: 'automationDuration', type: 'string' },
    { name: 'validUntil', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

// Keep old types for backward compatibility
export const DCA_ORDER_TYPES = COMPLETE_DCA_SETUP_TYPES;

// EIP-712 Types for Session Key Authorization
export const SESSION_KEY_TYPES = {
  SessionKeyAuthorization: [
    { name: 'user', type: 'address' },
    { name: 'smartWallet', type: 'address' },
    { name: 'sessionKey', type: 'address' },
    { name: 'permissions', type: 'string' },
    { name: 'validFrom', type: 'uint256' },
    { name: 'validUntil', type: 'uint256' },
    { name: 'purpose', type: 'string' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

// Create Complete DCA Setup Message (includes everything in one authorization)
export function createCompleteDCASetupMessage(
  userAddress: Address,
  smartWalletAddress: Address,
  totalAmount: number,
  amountPerOrder: number,
  frequency: string,
  numberOfOrders: number,
  platformFeePercentage: number,
  validUntilDays: number,
): TypedData {
  const validUntil =
    Math.floor(Date.now() / 1000) + validUntilDays * 24 * 60 * 60;
  const nonce = Math.floor(Date.now() / 1000); // Simple nonce using timestamp
  const platformFee = totalAmount * (platformFeePercentage / 100);

  const sessionPermissions = [
    '✅ Transfer USDC to smart wallet for DCA funding',
    '✅ Approve USDC spending for automated swaps',
    '✅ Execute swaps via OpenOcean DEX',
    '✅ Send SPX6900 directly to your external wallet',
    '✅ Return remaining funds when cancelled',
    '✅ All transactions are gas-free (sponsored)',
  ].join('\n');

  return {
    domain: DCA_DOMAIN,
    types: COMPLETE_DCA_SETUP_TYPES,
    primaryType: 'CompleteDCASetup',
    message: {
      user: userAddress,
      smartWallet: smartWalletAddress,
      fromToken: 'USDC',
      toToken: 'SPX6900',
      totalAmount: `$${totalAmount.toFixed(2)} USD`,
      amountPerOrder: `$${amountPerOrder.toFixed(2)} USD`,
      frequency: frequency.charAt(0).toUpperCase() + frequency.slice(1),
      numberOfOrders: BigInt(numberOfOrders),
      destinationWallet: userAddress, // SPX tokens go to user's external wallet
      platformFee: `$${platformFee.toFixed(2)} USD (${platformFeePercentage}%)`,
      sessionPermissions,
      automationDuration: `${validUntilDays} days`,
      validUntil: BigInt(validUntil),
      nonce: BigInt(nonce),
    },
  };
}

// Keep old function for backward compatibility but use new implementation
export function createDCAOrderMessage(
  userAddress: Address,
  smartWalletAddress: Address,
  totalAmount: number,
  amountPerOrder: number,
  frequency: string,
  numberOfOrders: number,
  platformFeePercentage: number,
  validUntilDays: number,
): TypedData {
  const validUntil =
    Math.floor(Date.now() / 1000) + validUntilDays * 24 * 60 * 60;
  const nonce = Math.floor(Date.now() / 1000); // Simple nonce using timestamp
  const platformFee = totalAmount * (platformFeePercentage / 100);

  return {
    domain: DCA_DOMAIN,
    types: DCA_ORDER_TYPES,
    primaryType: 'DCAOrder',
    message: {
      user: userAddress,
      smartWallet: smartWalletAddress,
      fromToken: 'USDC',
      toToken: 'SPX6900',
      totalAmount: `$${totalAmount.toFixed(2)} USD`,
      amountPerOrder: `$${amountPerOrder.toFixed(2)} USD`,
      frequency: frequency.charAt(0).toUpperCase() + frequency.slice(1),
      numberOfOrders: BigInt(numberOfOrders),
      destinationWallet: userAddress, // SPX tokens go to user's external wallet
      platformFee: `$${platformFee.toFixed(2)} USD (${platformFeePercentage}%)`,
      validUntil: BigInt(validUntil),
      nonce: BigInt(nonce),
    },
  };
}

// Create Session Key Authorization Message for Clear Signing
export function createSessionKeyMessage(
  userAddress: Address,
  smartWalletAddress: Address,
  sessionKeyAddress: Address,
  validUntilDays: number,
): TypedData {
  const validFrom = Math.floor(Date.now() / 1000);
  const validUntil = validFrom + validUntilDays * 24 * 60 * 60;
  const nonce = Math.floor(Date.now() / 1000);

  const permissions = [
    '• Transfer USDC from smart wallet',
    '• Approve USDC spending for swaps',
    '• Execute swaps via OpenOcean DEX',
    '• Transfer SPX6900 tokens to your wallet',
    '• Return remaining funds when cancelled',
  ].join('\n');

  return {
    domain: DCA_DOMAIN,
    types: SESSION_KEY_TYPES,
    primaryType: 'SessionKeyAuthorization',
    message: {
      user: userAddress,
      smartWallet: smartWalletAddress,
      sessionKey: sessionKeyAddress,
      permissions,
      validFrom: BigInt(validFrom),
      validUntil: BigInt(validUntil),
      purpose: 'Automate DCA swaps with gas sponsorship',
      nonce: BigInt(nonce),
    },
  };
}

// Create Fund Transfer Authorization Message
export const FUND_TRANSFER_TYPES = {
  FundTransfer: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'token', type: 'string' },
    { name: 'amount', type: 'string' },
    { name: 'purpose', type: 'string' },
    { name: 'recipient', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
} as const;

export function createFundTransferMessage(
  fromAddress: Address,
  toAddress: Address,
  amount: number,
): TypedData {
  return {
    domain: DCA_DOMAIN,
    types: FUND_TRANSFER_TYPES,
    primaryType: 'FundTransfer',
    message: {
      from: fromAddress,
      to: toAddress,
      token: 'USDC',
      amount: `$${amount.toFixed(2)} USD`,
      purpose: 'Fund smart wallet for DCA automation',
      recipient: 'Your Smart Wallet (automated trading)',
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
    },
  };
}

// Utility to format wallet addresses for display
export function formatAddressForDisplay(address: Address): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Create human-readable summary for complex transactions
export function createTransactionSummary(
  type: 'dca-setup' | 'session-key' | 'fund-transfer',
  details: Record<string, any>,
): string {
  switch (type) {
    case 'dca-setup':
      return `
🔄 DCA Order Setup
━━━━━━━━━━━━━━━━━━━
💰 Investment: ${details.amount} USD
📅 Frequency: ${details.frequency}
🎯 Target: SPX6900 tokens
🤖 Automation: Smart wallet
⛽ Gas: Sponsored (FREE)
📍 Delivery: Your external wallet
`;

    case 'session-key':
      return `
🔑 Session Key Authorization
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Purpose: Automate DCA swaps
⏰ Duration: ${details.days} days
🔒 Permissions: Limited to DCA operations
⛽ Gas: All transactions sponsored
🛡️ Security: Revokable at any time
`;

    case 'fund-transfer':
      return `
💸 Fund Smart Wallet
━━━━━━━━━━━━━━━━━━━━
💰 Amount: ${details.amount} USDC
📤 From: Your external wallet
📥 To: Your smart wallet
🎯 Purpose: DCA automation funding
`;

    default:
      return 'Transaction authorization required';
  }
}
