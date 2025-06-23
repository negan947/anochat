// Import fake-indexeddb to mock IndexedDB in tests
require('fake-indexeddb/auto');

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

// Increase test timeout
jest.setTimeout(10000); 