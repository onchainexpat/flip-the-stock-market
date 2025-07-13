#!/usr/bin/env node

// Test the contract service directly
require('dotenv').config({ path: '.env.local' });

async function testContractService() {
  try {
    // Import the contract service
    const { dcaGelatoContractService } = await import('./src/services/dcaGelatoContractService.ts');
    
    console.log('🔧 Testing DCA Gelato Contract Service...\n');
    
    // Get contract info
    const contractInfo = dcaGelatoContractService.getContractInfo();
    console.log('📋 Contract Info:');
    console.log('   Address:', contractInfo.address);
    console.log('   Has Wallet:', contractInfo.hasWallet);
    console.log('   Wallet Address:', contractInfo.walletAddress || 'Not configured');
    console.log('   RPC URL:', contractInfo.rpcUrl);
    console.log('');
    
    // Check if we can read from contract
    console.log('🔍 Testing contract read access...');
    try {
      const result = await dcaGelatoContractService.checkReadyOrders();
      console.log('✅ Contract read test:', result);
    } catch (err) {
      console.log('❌ Contract read failed:', err.message);
    }
    
    // Check environment variables
    console.log('\n🔑 Environment Variables:');
    console.log('   GELATO_DEPLOYER_PRIVATE_KEY:', process.env.GELATO_DEPLOYER_PRIVATE_KEY ? 'Set' : 'NOT SET');
    console.log('   DCA_RESOLVER_ADDRESS:', process.env.DCA_RESOLVER_ADDRESS || 'NOT SET');
    console.log('   NEXT_PUBLIC_ZERODEV_RPC_URL:', process.env.NEXT_PUBLIC_ZERODEV_RPC_URL ? 'Set' : 'NOT SET');
    
    if (!process.env.GELATO_DEPLOYER_PRIVATE_KEY) {
      console.log('\n⚠️  WARNING: GELATO_DEPLOYER_PRIVATE_KEY not set!');
      console.log('   This means the contract service cannot write to the contract.');
      console.log('   Orders will be created in the database but not registered in the smart contract.');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testContractService();