import { NextResponse } from 'next/server';
import { webcrypto } from 'node:crypto';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Test Web Crypto API
    const data = new TextEncoder().encode('test data');
    const key = await webcrypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const encrypted = await webcrypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return NextResponse.json({
      success: true,
      message: 'Crypto API working',
      encryptedLength: encrypted.byteLength,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}