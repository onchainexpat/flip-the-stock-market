'use client';
import ReceiveModal from '@/components/Auth/ReceiveModal';
import { useState } from 'react';

export default function TestReceiveModal() {
  const [showModal, setShowModal] = useState(false);
  const testAddress = '0xc9cA4528e9AD4a1c621F5a6543FB679F2ed03dB8';

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h1 className="text-white text-2xl mb-8">Test Receive Modal</h1>
      
      <div className="space-y-4">
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
        >
          Open Receive Modal
        </button>
        
        <div className="text-white">
          <p>Modal State: {showModal ? 'Open' : 'Closed'}</p>
          <p>Test Address: {testAddress}</p>
        </div>
      </div>

      <ReceiveModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        address={testAddress}
      />
    </div>
  );
}