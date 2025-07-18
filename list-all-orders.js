#!/usr/bin/env node

// Development script to list all orders to help identify user address

const { Redis } = require('@upstash/redis');

async function listAllOrders() {
  try {
    if (process.env.NODE_ENV !== 'development') {
      console.log('❌ This script only runs in development mode');
      process.exit(1);
    }

    console.log('🔍 Connecting to Redis to list all DCA orders...');

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Get all DCA order keys
    const smartWalletKeys = await redis.keys('dca_order:*');
    const openOceanKeys = await redis.keys('openocean_dca_order:*');

    console.log(
      `📊 Found ${smartWalletKeys.length} smart wallet orders and ${openOceanKeys.length} OpenOcean orders`,
    );

    // List smart wallet orders
    if (smartWalletKeys.length > 0) {
      console.log('\n🔑 Smart Wallet DCA Orders:');
      for (const key of smartWalletKeys) {
        try {
          const order = await redis.get(key);
          if (order) {
            const orderId = key.replace('dca_order:', '');
            console.log(`   ID: ${orderId}`);
            console.log(`   User: ${order.userAddress}`);
            console.log(`   Status: ${order.status}`);
            console.log(
              `   Amount: ${order.totalAmount} (executed: ${order.executedAmount})`,
            );
            console.log(
              `   Created: ${new Date(order.createdAt).toLocaleString()}`,
            );
            console.log('   ---');
          }
        } catch (error) {
          console.log(`   ❌ Error reading ${key}: ${error.message}`);
        }
      }
    }

    // List OpenOcean orders
    if (openOceanKeys.length > 0) {
      console.log('\n🌊 OpenOcean DCA Orders:');
      for (const key of openOceanKeys) {
        try {
          const order = await redis.get(key);
          if (order) {
            const orderId = key.replace('openocean_dca_order:', '');
            console.log(`   ID: ${orderId}`);
            console.log(`   User: ${order.userAddress}`);
            console.log(`   Status: ${order.status}`);
            console.log(`   OrderHash: ${order.orderHash || 'N/A'}`);
            console.log(
              `   Amount: ${order.totalAmount} (executed: ${order.executedAmount})`,
            );
            console.log(
              `   Created: ${new Date(order.createdAt).toLocaleString()}`,
            );
            console.log('   ---');
          }
        } catch (error) {
          console.log(`   ❌ Error reading ${key}: ${error.message}`);
        }
      }
    }

    if (smartWalletKeys.length === 0 && openOceanKeys.length === 0) {
      console.log('✅ No DCA orders found in the database.');
    } else {
      console.log('\n💡 To remove orders for a specific user, run:');
      console.log('   node remove-orders.js 0xYourWalletAddressFromAbove');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listAllOrders();
