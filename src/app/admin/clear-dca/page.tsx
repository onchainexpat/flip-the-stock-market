'use client';

import { useState } from 'react';
import {
  type DcaClearResult,
  clearAllDcaData,
  clearClientDcaData,
  clearServerDcaData,
  getClientDcaStats,
  previewServerDcaData,
} from '../../../utils/dcaDataCleaner';

export default function ClearDcaPage() {
  const [adminKey, setAdminKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DcaClearResult | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [clientStats, setClientStats] = useState(getClientDcaStats());

  const handlePreview = async () => {
    if (!adminKey.trim()) {
      setResult({
        success: false,
        message: 'Admin key is required',
        error: 'Please enter the admin key',
      });
      return;
    }

    setIsLoading(true);
    try {
      const previewResult = await previewServerDcaData(adminKey);
      setPreview(previewResult);

      // Refresh client stats
      setClientStats(getClientDcaStats());
    } catch (error) {
      console.error('Preview failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!adminKey.trim()) {
      setResult({
        success: false,
        message: 'Admin key is required',
        error: 'Please enter the admin key',
      });
      return;
    }

    if (
      !confirm(
        'Are you sure you want to clear ALL DCA data? This action cannot be undone!',
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const clearResult = await clearAllDcaData(adminKey);
      setResult(clearResult);

      // Refresh stats after clearing
      setClientStats(getClientDcaStats());
      setPreview(null);
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to clear DCA data',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearClientOnly = async () => {
    if (
      !confirm(
        'Are you sure you want to clear client-side DCA data (localStorage)?',
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const clearResult = await clearClientDcaData();
      setResult(clearResult);
      setClientStats(getClientDcaStats());
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to clear client DCA data',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearServerOnly = async () => {
    if (!adminKey.trim()) {
      setResult({
        success: false,
        message: 'Admin key is required',
        error: 'Please enter the admin key',
      });
      return;
    }

    if (
      !confirm('Are you sure you want to clear server-side DCA data (Redis)?')
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const clearResult = await clearServerDcaData(adminKey);
      setResult(clearResult);
      setPreview(null);
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to clear server DCA data',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🧹 DCA Data Management
          </h1>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">
              ⚠️ Warning
            </h2>
            <p className="text-yellow-700">
              This page allows you to clear all DCA order data from both
              client-side storage (localStorage) and server-side storage
              (Redis). This action is <strong>irreversible</strong> and will
              delete all orders, executions, and user mappings.
            </p>
          </div>

          {/* Admin Key Input */}
          <div className="mb-6">
            <label
              htmlFor="adminKey"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Admin Key
            </label>
            <input
              type="password"
              id="adminKey"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter admin key..."
            />
            <p className="text-sm text-gray-500 mt-1">
              Default for development: <code>dev-admin-clear-dca</code>
            </p>
          </div>

          {/* Current Data Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">
                📱 Client-Side Data
              </h3>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Has Data:</span>{' '}
                  {clientStats.hasData ? '✅ Yes' : '❌ No'}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Orders:</span>{' '}
                  {clientStats.ordersCount}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Executions:</span>{' '}
                  {clientStats.executionsCount}
                </p>
                <p className="text-sm">
                  <span className="font-medium">User Addresses:</span>{' '}
                  {clientStats.userAddresses}
                </p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-3">
                ☁️ Server-Side Data
              </h3>
              {preview?.success ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Total Keys:</span>{' '}
                    {preview.data.totalKeys}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Orders:</span>{' '}
                    {preview.data.orders}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Executions:</span>{' '}
                    {preview.data.executions}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">User Mappings:</span>{' '}
                    {preview.data.userMappings}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Click "Preview Server Data" to load
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <button
              onClick={handlePreview}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {isLoading ? '🔄 Loading...' : '👀 Preview Server Data'}
            </button>

            <button
              onClick={handleClearClientOnly}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {isLoading ? '🔄 Clearing...' : '📱 Clear Client Only'}
            </button>

            <button
              onClick={handleClearServerOnly}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {isLoading ? '🔄 Clearing...' : '☁️ Clear Server Only'}
            </button>

            <button
              onClick={handleClearAll}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              {isLoading ? '🔄 Clearing...' : '🧹 Clear All Data'}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div
              className={`rounded-lg p-4 mb-6 ${
                result.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <h3
                className={`text-lg font-semibold mb-2 ${
                  result.success ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {result.success ? '✅ Success' : '❌ Error'}
              </h3>
              <p className={result.success ? 'text-green-700' : 'text-red-700'}>
                {result.message}
              </p>
              {result.details && (
                <div className="mt-3 text-sm">
                  <p className="font-medium">Details:</p>
                  <ul className="ml-4 space-y-1">
                    {result.details.localStorage !== undefined && (
                      <li>
                        Client-side:{' '}
                        {result.details.localStorage
                          ? '✅ Cleared'
                          : '❌ Failed'}
                      </li>
                    )}
                    {result.details.serverSide && (
                      <li>
                        Server-side: ✅ Cleared{' '}
                        {result.details.serverSide.deletedKeys} keys (
                        {result.details.serverSide.orders} orders,{' '}
                        {result.details.serverSide.executions} executions)
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {result.error && (
                <p className="text-red-600 text-sm mt-2">
                  <strong>Error:</strong> {result.error}
                </p>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              📝 Instructions
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <strong>Preview Server Data:</strong> Check what DCA data exists
                in Redis without deleting anything.
              </p>
              <p>
                <strong>Clear Client Only:</strong> Remove DCA data from browser
                localStorage only.
              </p>
              <p>
                <strong>Clear Server Only:</strong> Remove DCA data from Redis
                only (requires admin key).
              </p>
              <p>
                <strong>Clear All Data:</strong> Remove DCA data from both
                client and server storage.
              </p>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>Command Line Alternative:</strong> You can also use the
                script:
              </p>
              <code className="text-xs bg-blue-100 px-2 py-1 rounded mt-1 block">
                bun run src/scripts/clearDcaData.ts preview
              </code>
              <code className="text-xs bg-blue-100 px-2 py-1 rounded mt-1 block">
                bun run src/scripts/clearDcaData.ts clear
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
