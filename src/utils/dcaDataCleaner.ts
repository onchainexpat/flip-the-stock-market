'use client';

/**
 * Utility functions for clearing DCA data from various storage systems
 */

import { dcaDatabase } from '../lib/dcaDatabase';

export interface DcaClearResult {
  success: boolean;
  message: string;
  details?: {
    localStorage?: boolean;
    serverSide?: {
      deletedKeys: number;
      orders: number;
      executions: number;
      userMappings: number;
    };
  };
  error?: string;
}

/**
 * Clear DCA data from localStorage (client-side only)
 */
export async function clearClientDcaData(): Promise<DcaClearResult> {
  try {
    // Use the built-in clearAll method from dcaDatabase
    await dcaDatabase.clearAll();

    // Also clear the raw localStorage item as backup
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dca-database');
    }

    return {
      success: true,
      message: 'Client-side DCA data cleared successfully',
      details: {
        localStorage: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to clear client-side DCA data',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clear DCA data from server-side storage (Redis)
 * Requires admin authentication
 */
export async function clearServerDcaData(
  adminKey: string,
): Promise<DcaClearResult> {
  try {
    const response = await fetch('/api/admin/clear-dca-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ adminKey }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.error || 'Failed to clear server-side DCA data',
        error: data.error,
      };
    }

    return {
      success: true,
      message: data.message,
      details: {
        serverSide: {
          deletedKeys: data.deletedKeys,
          orders: data.details.orders,
          executions: data.details.executions,
          userMappings: data.details.userMappings,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to communicate with server',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clear all DCA data from both client and server storage
 */
export async function clearAllDcaData(
  adminKey: string,
): Promise<DcaClearResult> {
  try {
    // Clear client-side data first
    const clientResult = await clearClientDcaData();

    // Clear server-side data
    const serverResult = await clearServerDcaData(adminKey);

    const bothSuccessful = clientResult.success && serverResult.success;

    return {
      success: bothSuccessful,
      message: bothSuccessful
        ? 'All DCA data cleared successfully from both client and server'
        : 'Partial failure clearing DCA data',
      details: {
        localStorage: clientResult.success,
        serverSide: serverResult.details?.serverSide,
      },
      error: bothSuccessful
        ? undefined
        : `Client: ${clientResult.error || 'OK'}, Server: ${serverResult.error || 'OK'}`,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to clear DCA data',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Preview what DCA data exists in server storage
 */
export async function previewServerDcaData(adminKey: string): Promise<{
  success: boolean;
  data?: {
    totalKeys: number;
    orders: number;
    executions: number;
    userMappings: number;
    otherKeys: number;
  };
  error?: string;
}> {
  try {
    const response = await fetch(
      `/api/admin/clear-dca-data?adminKey=${encodeURIComponent(adminKey)}`,
      {
        method: 'GET',
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to preview DCA data',
      };
    }

    return {
      success: true,
      data: {
        totalKeys: data.totalKeys,
        orders: data.details.orders,
        executions: data.details.executions,
        userMappings: data.details.userMappings,
        otherKeys: data.details.otherKeys,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current DCA data statistics from localStorage
 */
export function getClientDcaStats(): {
  hasData: boolean;
  ordersCount: number;
  executionsCount: number;
  userAddresses: number;
} {
  if (typeof window === 'undefined') {
    return {
      hasData: false,
      ordersCount: 0,
      executionsCount: 0,
      userAddresses: 0,
    };
  }

  try {
    const stored = localStorage.getItem('dca-database');
    if (!stored) {
      return {
        hasData: false,
        ordersCount: 0,
        executionsCount: 0,
        userAddresses: 0,
      };
    }

    const data = JSON.parse(stored);
    const orders = data.orders || [];
    const executions = data.executions || [];
    const userOrders = data.userOrders || [];

    return {
      hasData: true,
      ordersCount: orders.length,
      executionsCount: executions.length,
      userAddresses: userOrders.length,
    };
  } catch (error) {
    console.error('Failed to parse DCA data from localStorage:', error);
    return {
      hasData: false,
      ordersCount: 0,
      executionsCount: 0,
      userAddresses: 0,
    };
  }
}
