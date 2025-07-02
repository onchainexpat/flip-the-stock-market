import { NextResponse } from 'next/server';
import { serverDcaDatabase } from '../../../lib/serverDcaDatabase';

export async function GET() {
  try {
    const orders = await serverDcaDatabase.getOrdersDueForExecution();

    const debugData = orders.map((order) => ({
      orderId: order.id,
      userAddress: order.userAddress,
      sessionKeyDataRaw: order.sessionKeyData,
      sessionKeyDataParsed: (() => {
        try {
          return JSON.parse(order.sessionKeyData);
        } catch (e) {
          return `Parse Error: ${(e as Error).message}`;
        }
      })(),
    }));

    return NextResponse.json({
      success: true,
      orderCount: orders.length,
      debugData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
