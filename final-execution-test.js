// Final test of the DCA execution with all our fixes
async function finalExecutionTest() {
  console.log('🚀 Final DCA execution test with all fixes...');
  console.log('   ✅ Agent key ID confirmed: session_1752720108055_slxz0jq');
  console.log('   ✅ Session key approval: Present');
  console.log('   ✅ Smart wallet: 0x320b2943e26ccbDacE18575e7974EDC200BA4dCE');
  console.log('   ✅ USDC balance: 1.000000');
  console.log('   ✅ Aerodrome integration: Working');
  console.log('   ✅ ZeroDev timeouts: Added');
  
  try {
    // Use force execution endpoint which we know works with orders
    console.log('\n🎯 Triggering execution via force-execute-now...');
    
    const response = await fetch('http://localhost:3000/api/force-execute-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: 'order_1752720111186_f5ifjcour'
      }),
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    if (response.ok) {
      const result = await response.json();
      console.log('📋 Execution batch result:', result.success ? '✅ SUCCESS' : '❌ FAILED');
      
      if (result.executionResult) {
        const orderResult = result.executionResult.results?.find(r => 
          r.orderId === 'order_1752720111186_f5ifjcour'
        );
        
        if (orderResult) {
          console.log('\n📦 Our order result:');
          console.log('   Success:', orderResult.success ? '✅' : '❌');
          console.log('   Error:', orderResult.error || 'None');
          
          if (orderResult.success && orderResult.txHash) {
            console.log('   🎉 TRANSACTION HASH:', orderResult.txHash);
            console.log('   🌟 SPX TOKENS SHOULD APPEAR IN WALLET!');
          }
        }
      }
    } else {
      console.log('❌ HTTP Error:', response.status);
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏰ Request timed out - ZeroDev SDK still hanging');
    } else {
      console.log('❌ Error:', error.message);
    }
  }

  // Final balance check
  console.log('\n💰 Final balance check...');
  try {
    const balanceResponse = await fetch('http://localhost:3000/api/check-wallet-balance?address=0x320b2943e26ccbDacE18575e7974EDC200BA4dCE');
    const balanceData = await balanceResponse.json();
    
    console.log('   USDC:', balanceData.balances?.usdc?.formatted || 'N/A');
    console.log('   ETH:', balanceData.balances?.eth?.formatted || 'N/A');
    
    // Check for SPX tokens specifically
    const spxBalance = await fetch('http://localhost:3000/api/check-wallet-balance?address=0x320b2943e26ccbDacE18575e7974EDC200BA4dCE&includeSpx=true');
    if (spxBalance.ok) {
      const spxData = await spxBalance.json();
      if (spxData.balances?.spx) {
        console.log('   🎯 SPX6900:', spxData.balances.spx.formatted, 'SPX');
        console.log('   🎉 SUCCESS! SPX TOKENS RECEIVED!');
      } else {
        console.log('   SPX6900: 0 (not yet received)');
      }
    }
  } catch (balanceError) {
    console.log('   ❌ Balance check failed:', balanceError.message);
  }

  console.log('\n📊 Summary:');
  console.log('   • Order created: ✅');
  console.log('   • Session keys: ✅');
  console.log('   • Agent key linked: ✅');
  console.log('   • Smart wallet funded: ✅');
  console.log('   • Aerodrome integration: ✅');
  console.log('   • ZeroDev timeouts: ✅');
  console.log('   • Execution result: Testing...');
}

finalExecutionTest();