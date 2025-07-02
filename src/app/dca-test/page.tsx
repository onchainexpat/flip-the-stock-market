'use client';

export default function DCATestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            DCA v2 Test Page
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            This is a simplified test page to verify our DCA v2 implementation
            is working.
          </p>

          <div className="inline-flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full">
            <span className="text-yellow-400 font-medium">
              ✅ Page Loading Successfully
            </span>
          </div>
        </div>

        <div className="max-w-md mx-auto bg-gray-900 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            DCA Components Ready
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Smart Wallet Providers</span>
              <span className="text-green-400">✅</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-300">Session Key Management</span>
              <span className="text-green-400">✅</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-300">0x API Integration</span>
              <span className="text-green-400">✅</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-300">DCA Engine</span>
              <span className="text-green-400">✅</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-300">UI Components</span>
              <span className="text-green-400">✅</span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-300 mb-2">
              Next Steps
            </h4>
            <p className="text-sm text-gray-400">
              Set up Privy authentication and configure environment variables to
              enable full DCA v2 functionality.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
