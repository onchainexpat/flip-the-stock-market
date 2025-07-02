// Polyfill for crypto.randomUUID if not available
// This fixes the OnchainKit compatibility issue with certain Node.js versions

if (typeof globalThis !== 'undefined') {
  // Ensure crypto object exists
  if (!globalThis.crypto) {
    globalThis.crypto = {} as any;
  }

  // Add randomUUID if not available
  if (!globalThis.crypto.randomUUID) {
    globalThis.crypto.randomUUID = () => {
      // Generate a RFC 4122 version 4 UUID
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  }
}

// Also add to window if in browser environment
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    (window as any).crypto = {};
  }

  if (!window.crypto.randomUUID) {
    (window.crypto as any).randomUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  }
}

export {};
