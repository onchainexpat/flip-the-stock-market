import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { base } from 'viem/chains';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount } from '@zerodev/sdk';
import { getEntryPoint, KERNEL_V3_2 } from '@zerodev/sdk/constants';

export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('🧪 Testing ZeroDev imports...');
    
    // Test basic viem functionality
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    
    const ZERODEV_RPC_URL = process.env.NEXT_PUBLIC_ZERODEV_RPC_URL || 'https://mainnet.base.org';
    
    const publicClient = createPublicClient({
      chain: base,
      transport: http(ZERODEV_RPC_URL),
    });
    
    console.log('✅ Testing ECDSA validator creation...');
    
    // Test ECDSA validator creation
    const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
      signer: account,
      entryPoint: getEntryPoint('0.7'),
      kernelVersion: KERNEL_V3_2,
    });
    
    console.log('✅ ECDSA validator created');
    console.log('✅ Testing kernel account creation...');
    
    // Test kernel account creation
    const kernelAccount = await createKernelAccount(publicClient, {
      entryPoint: getEntryPoint('0.7'),
      plugins: {
        sudo: ecdsaValidator,
      },
      kernelVersion: KERNEL_V3_2,
    });
    
    console.log('✅ Kernel account created');
    console.log('   Account:', account.address);
    console.log('   Kernel Account:', kernelAccount.address);
    console.log('   EntryPoint:', getEntryPoint('0.7'));
    
    return NextResponse.json({
      success: true,
      message: 'Kernel account creation successful',
      originalAddress: account.address,
      kernelAddress: kernelAccount.address,
      entryPoint: getEntryPoint('0.7'),
    });
    
  } catch (error) {
    console.error('❌ Basic test failed:', error);
    
    let errorMessage = 'Test failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error, null, 2);
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}