#!/usr/bin/env node

const { ethers } = require('ethers');

// Contract setup
const CONTRACT_ADDRESS = '0xcb3E5B789Ff429C54dc940c5e495F278e13eAC8d';
const RPC_URL = 'https://mainnet.base.org';

const CONTRACT_ABI = [
  {
    inputs: [],
    name: 'checker',
    outputs: [
      { internalType: 'bool', name: 'canExec', type: 'bool' },
      { internalType: 'bytes', name: 'execPayload', type: 'bytes' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalOrders',
    outputs: [{ internalType: 'uint256', name: 'count', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getReadyOrders',
    outputs: [
      { internalType: 'bytes32[]', name: 'readyOrders', type: 'bytes32[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'allOrderIds',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function debugContract() {
  try {
    console.log('🔍 Debugging Gelato DCA Contract...\n');

    // Setup provider and contract
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider,
    );

    console.log('📋 Contract Address:', CONTRACT_ADDRESS);
    console.log('🌐 RPC URL:', RPC_URL);
    console.log('');

    // Check total orders
    console.log('📊 Checking total orders...');
    try {
      const totalOrders = await contract.getTotalOrders();
      console.log('✅ Total orders in contract:', totalOrders.toString());

      if (totalOrders > 0) {
        // Get first few order IDs
        console.log('\n📝 Order IDs:');
        for (let i = 0; i < Math.min(totalOrders, 5); i++) {
          try {
            const orderId = await contract.allOrderIds(i);
            console.log(`   ${i}: ${orderId}`);
          } catch (err) {
            console.log(`   ${i}: Error reading order ID - ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.log('❌ Error getting total orders:', err.message);
    }

    // Check ready orders
    console.log('\n🔍 Checking ready orders...');
    try {
      const readyOrders = await contract.getReadyOrders();
      console.log('✅ Ready orders:', readyOrders.length);
      if (readyOrders.length > 0) {
        readyOrders.forEach((orderId, index) => {
          console.log(`   ${index}: ${orderId}`);
        });
      } else {
        console.log('   No orders ready for execution');
      }
    } catch (err) {
      console.log('❌ Error getting ready orders:', err.message);
    }

    // Test checker function (same as Gelato calls)
    console.log('\n🤖 Testing checker() function (Gelato resolver)...');
    try {
      const [canExec, execPayload] = await contract.checker();
      console.log('✅ canExec:', canExec);
      console.log('✅ execPayload length:', execPayload.length);
      console.log(
        '✅ execPayload:',
        execPayload === '0x' ? 'Empty (0x)' : execPayload,
      );

      if (canExec) {
        console.log('🎉 Contract says orders are ready for execution!');
      } else {
        console.log('⏳ Contract says no orders ready yet');
        console.log('   This is why Gelato shows !canExec');
      }
    } catch (err) {
      console.log('❌ Error calling checker():', err.message);
    }

    // Get current timestamp for comparison
    const currentTime = Math.floor(Date.now() / 1000);
    console.log('\n⏰ Current timestamp:', currentTime);
    console.log('📅 Current time:', new Date().toISOString());
  } catch (error) {
    console.error('💥 Debug failed:', error.message);
  }
}

debugContract();
