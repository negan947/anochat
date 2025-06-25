// Import fake-indexeddb to mock IndexedDB in tests
require('fake-indexeddb/auto');

// Add TextEncoder/TextDecoder polyfill for Node.js
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Add structuredClone polyfill for Node.js
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Mock window crypto API for tests
global.crypto = {
  getRandomValues: (buffer) => {
    return require('crypto').randomFillSync(buffer);
  }
};

// Fix sessionStorage mock to be proper Jest mocks
Object.defineProperty(global, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true
});

// Mock document for session management tests
if (typeof global.document === 'undefined') {
  Object.defineProperty(global, 'document', {
    value: {
      hidden: false,
      hasFocus: jest.fn(() => true),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      createElement: jest.fn(() => ({
        getContext: jest.fn(() => ({
          fillText: jest.fn(),
        })),
        toDataURL: jest.fn(() => 'data:image/png;base64,test'),
      })),
    },
    writable: true
  });
}

// Mock window for session management tests
if (typeof global.window === 'undefined') {
  Object.defineProperty(global, 'window', {
    value: {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    writable: true
  });
}

// Increase test timeout
jest.setTimeout(10000); 