'use client';

import { useAccount, useSignTypedData } from 'wagmi';
import { useWallets } from '@privy-io/react-auth';
import { toast } from 'react-hot-toast';
import { type TypedData, type Address } from 'viem';
import {
  createDCAOrderMessage,
  createSessionKeyMessage,
  createFundTransferMessage,
  createCompleteDCASetupMessage,
  createTransactionSummary,
  formatAddressForDisplay,
} from '../utils/eip712Signing';

export function useClearSigning() {
  const { address } = useAccount();
  const { wallets } = useWallets();
  const { signTypedDataAsync } = useSignTypedData();

  // Get active wallet (Privy or Wagmi)
  const activeWallet = wallets.find(w => w.address === address) || wallets[0];

  /**
   * Sign a DCA order with clear, human-readable message
   */
  const signDCAOrder = async (
    smartWalletAddress: Address,
    totalAmount: number,
    amountPerOrder: number,
    frequency: string,
    numberOfOrders: number,
    platformFeePercentage: number,
    validUntilDays: number
  ): Promise<string> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    const typedData = createDCAOrderMessage(
      address,
      smartWalletAddress,
      totalAmount,
      amountPerOrder,
      frequency,
      numberOfOrders,
      platformFeePercentage,
      validUntilDays
    );

    const summary = createTransactionSummary('dca-setup', {
      amount: totalAmount,
      frequency,
      numberOfOrders,
    });

    // Show user-friendly toast before signing
    toast(summary, {
      duration: 5000,
      icon: '🔄',
    });

    console.log('🔏 DCA Order - Clear Signing Data:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 What you are signing:');
    console.log(`   💰 Total Investment: $${totalAmount.toFixed(2)} USD`);
    console.log(`   📊 Per Order: $${amountPerOrder.toFixed(2)} USD`);
    console.log(`   📅 Frequency: ${frequency}`);
    console.log(`   🔢 Number of Orders: ${numberOfOrders}`);
    console.log(`   💳 Platform Fee: ${platformFeePercentage}%`);
    console.log(`   👤 Your Wallet: ${formatAddressForDisplay(address)}`);
    console.log(`   🤖 Smart Wallet: ${formatAddressForDisplay(smartWalletAddress)}`);
    console.log(`   📍 SPX Delivery: Your external wallet`);
    console.log(`   ⏰ Valid Until: ${validUntilDays} days`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const signature = await signTypedDataAsync(typedData);
      console.log('✅ DCA Order signature obtained:', signature.slice(0, 20) + '...');
      toast.success('DCA order authorization signed!');
      return signature;
    } catch (error) {
      console.error('❌ DCA order signing failed:', error);
      toast.error('Signature cancelled or failed');
      throw error;
    }
  };

  /**
   * Sign session key authorization with clear message
   */
  const signSessionKeyAuthorization = async (
    smartWalletAddress: Address,
    sessionKeyAddress: Address,
    validUntilDays: number
  ): Promise<string> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    const typedData = createSessionKeyMessage(
      address,
      smartWalletAddress,
      sessionKeyAddress,
      validUntilDays
    );

    const summary = createTransactionSummary('session-key', {
      days: validUntilDays,
    });

    toast(summary, {
      duration: 5000,
      icon: '🔑',
    });

    console.log('🔑 Session Key - Clear Signing Data:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 What you are authorizing:');
    console.log(`   👤 Your Wallet: ${formatAddressForDisplay(address)}`);
    console.log(`   🤖 Smart Wallet: ${formatAddressForDisplay(smartWalletAddress)}`);
    console.log(`   🔑 Session Key: ${formatAddressForDisplay(sessionKeyAddress)}`);
    console.log(`   ⏰ Valid For: ${validUntilDays} days`);
    console.log('   🎯 Purpose: Automate DCA swaps with gas sponsorship');
    console.log('   🔒 Permissions:');
    console.log('      • Transfer USDC from smart wallet');
    console.log('      • Approve USDC for DEX swaps');
    console.log('      • Execute swaps via OpenOcean');
    console.log('      • Transfer SPX6900 to your wallet');
    console.log('      • Return funds when cancelled');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const signature = await signTypedDataAsync(typedData);
      console.log('✅ Session key authorization signature obtained');
      toast.success('Session key authorized!');
      return signature;
    } catch (error) {
      console.error('❌ Session key signing failed:', error);
      toast.error('Authorization cancelled or failed');
      throw error;
    }
  };

  /**
   * Sign fund transfer authorization with clear message
   */
  const signFundTransfer = async (
    smartWalletAddress: Address,
    amount: number
  ): Promise<string> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    const typedData = createFundTransferMessage(
      address,
      smartWalletAddress,
      amount
    );

    const summary = createTransactionSummary('fund-transfer', {
      amount,
    });

    toast(summary, {
      duration: 4000,
      icon: '💸',
    });

    console.log('💸 Fund Transfer - Clear Signing Data:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 What you are transferring:');
    console.log(`   💵 Amount: $${amount.toFixed(2)} USD (USDC)`);
    console.log(`   📤 From: ${formatAddressForDisplay(address)} (Your wallet)`);
    console.log(`   📥 To: ${formatAddressForDisplay(smartWalletAddress)} (Smart wallet)`);
    console.log('   🎯 Purpose: Fund DCA automation');
    console.log('   ✅ Benefits: Gas-free automated swaps');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const signature = await signTypedDataAsync(typedData);
      console.log('✅ Fund transfer authorization signature obtained');
      toast.success('Fund transfer authorized!');
      return signature;
    } catch (error) {
      console.error('❌ Fund transfer signing failed:', error);
      toast.error('Transfer authorization cancelled');
      throw error;
    }
  };

  /**
   * Generic clear signing with custom message
   */
  const signWithClearMessage = async (
    title: string,
    description: string,
    details: Record<string, string>
  ): Promise<string> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    // Add slippage info to manual execution messages
    const enhancedDetails = title.includes('Manual Execute') || title.includes('Execute DCA') 
      ? { ...details, '📊 Slippage Tolerance': '3% (improved for better execution)' }
      : details;

    // Create a simple message for signing
    const message = `${title}\n\n${description}\n\n${Object.entries(enhancedDetails)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')}`;

    console.log('✨ Clear Message Signing:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 ${title}`);
    console.log(`📝 ${description}`);
    Object.entries(enhancedDetails).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Use personal_sign for simple message signing
      if (activeWallet) {
        const provider = await activeWallet.getEthereumProvider();
        const signature = await provider.request({
          method: 'personal_sign',
          params: [message, address],
        });
        console.log('✅ Clear message signature obtained');
        toast.success('Message signed successfully!');
        return signature;
      } else {
        throw new Error('No active wallet found');
      }
    } catch (error) {
      console.error('❌ Clear message signing failed:', error);
      toast.error('Message signing cancelled');
      throw error;
    }
  };

  /**
   * Sign complete DCA setup with order details and fund transfer in one message
   */
  const signCompleteDCASetup = async (
    smartWalletAddress: Address,
    totalAmount: number,
    amountPerOrder: number,
    frequency: string,
    numberOfOrders: number,
    platformFeePercentage: number,
    validUntilDays: number
  ): Promise<string> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    // Create a comprehensive message that includes both order and funding
    const platformFee = totalAmount * (platformFeePercentage / 100);
    
    const details = {
      '💰 Total Investment': `$${totalAmount.toFixed(2)} USD`,
      '📤 From Wallet': formatAddressForDisplay(address),
      '🤖 Smart Wallet': formatAddressForDisplay(smartWalletAddress),
      '📊 Per Order': `$${amountPerOrder.toFixed(2)} USD`,
      '📅 Frequency': frequency.charAt(0).toUpperCase() + frequency.slice(1),
      '🔢 Total Orders': numberOfOrders.toString(),
      '💳 Platform Fee': `$${platformFee.toFixed(2)} (${platformFeePercentage}%)`,
      '🎯 SPX Delivery': 'Your external wallet',
      '⛽ Gas': 'Sponsored (FREE)',
      '⏰ Duration': `${validUntilDays} days`,
    };

    const summary = `
🔄 Complete DCA Setup Authorization
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONE signature for everything:

✅ Transfer $${totalAmount.toFixed(2)} USDC to smart wallet
✅ Create ${numberOfOrders} automated DCA orders
✅ Grant session key permissions for automation
✅ Enable gas-free swap execution
✅ Direct SPX delivery to your wallet

${Object.entries(details).map(([key, value]) => `${key}: ${value}`).join('\n')}

No additional signatures required!
`;

    toast(summary, {
      duration: 6000,
      icon: '🔄',
    });

    console.log('🔏 Complete DCA Setup - Clear Signing:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Object.entries(details).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Use EIP-712 for the complete setup message
      const typedData = createCompleteDCASetupMessage(
        address,
        smartWalletAddress,
        totalAmount,
        amountPerOrder,
        frequency,
        numberOfOrders,
        platformFeePercentage,
        validUntilDays
      );
      
      const signature = await signTypedDataAsync(typedData);
      console.log('✅ Complete DCA setup signature obtained');
      toast.success('Complete DCA setup authorized!');
      return signature;
    } catch (error) {
      console.error('❌ DCA setup signing failed:', error);
      toast.error('Authorization cancelled');
      throw error;
    }
  };

  return {
    signDCAOrder,
    signSessionKeyAuthorization,
    signFundTransfer,
    signWithClearMessage,
    signCompleteDCASetup, // New combined method
    isWalletConnected: !!address,
    walletAddress: address,
  };
}