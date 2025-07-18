#!/usr/bin/env bun
/**
 * Debug Gelato task execution
 * Usage: bun run src/scripts/debug-gelato-task.ts <taskId>
 */

import { GelatoRelay } from '@gelatonetwork/relay-sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function debugGelatoTask(taskId: string) {
  console.log('🔍 Debugging Gelato Task:', taskId);
  console.log('=' .repeat(80));
  
  // Check environment
  const apiKey = process.env.GELATO_SPONSOR_API_KEY;
  console.log('\n📋 Environment Check:');
  console.log('   GELATO_SPONSOR_API_KEY exists:', !!apiKey);
  console.log('   API Key length:', apiKey?.length || 0);
  console.log('   API Key prefix:', apiKey?.substring(0, 10) + '...' || 'N/A');
  
  // Initialize relay
  console.log('\n🔧 Initializing Gelato Relay...');
  let relay: GelatoRelay;
  try {
    relay = new GelatoRelay();
    console.log('   ✅ Relay initialized successfully');
  } catch (error) {
    console.error('   ❌ Failed to initialize relay:', error);
    return;
  }
  
  // Check task status
  console.log('\n📊 Checking Task Status...');
  try {
    const status = await relay.getTaskStatus(taskId);
    console.log('   ✅ Task status retrieved:');
    console.log(JSON.stringify(status, null, 2));
    
    if ((status as any).transactionHash) {
      console.log(`\n🔗 Transaction: https://basescan.org/tx/${(status as any).transactionHash}`);
    }
  } catch (error) {
    console.error('   ❌ Failed to get task status:', error);
  }
  
  // Try direct API calls
  console.log('\n🌐 Trying Direct API Calls...');
  
  const endpoints = [
    {
      name: 'Relay Status API',
      url: `https://relay.gelato.digital/tasks/${taskId}`,
    },
    {
      name: '1Balance Status API',
      url: `https://relay.gelato.digital/1balance/v1/tasks/${taskId}`,
    },
    {
      name: 'Task Status API',
      url: `https://api.gelato.digital/tasks/status/${taskId}`,
    },
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n   Testing ${endpoint.name}...`);
    try {
      const headers: HeadersInit = {};
      if (apiKey) {
        headers['Authorization'] = apiKey.startsWith('Bearer') ? apiKey : `Bearer ${apiKey}`;
      }
      
      const response = await fetch(endpoint.url, { headers });
      const data = await response.json();
      
      console.log(`   Status: ${response.status}`);
      if (response.status === 200) {
        console.log('   ✅ Success:');
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log('   ❌ Failed:', data);
      }
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
  }
  
  // Check if task ID format is correct
  console.log('\n🔍 Task ID Analysis:');
  console.log('   Format:', taskId.startsWith('0x') ? 'Hex (correct)' : 'Not hex');
  console.log('   Length:', taskId.length, '(expected: 66)');
  console.log('   Valid hex:', /^0x[a-fA-F0-9]{64}$/.test(taskId) ? 'Yes' : 'No');
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (!apiKey) {
    console.log('   ⚠️  GELATO_SPONSOR_API_KEY is not set in environment');
  }
  if (taskId.length !== 66) {
    console.log('   ⚠️  Task ID length is incorrect (should be 66 characters)');
  }
  if (!taskId.startsWith('0x')) {
    console.log('   ⚠️  Task ID should start with 0x');
  }
  
  console.log('\n✅ Debug complete!');
}

// Main execution
const taskId = process.argv[2];
if (!taskId) {
  console.error('❌ Please provide a task ID as argument');
  console.error('Usage: bun run src/scripts/debug-gelato-task.ts <taskId>');
  process.exit(1);
}

debugGelatoTask(taskId).catch(console.error);