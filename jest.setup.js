// Mock window crypto API for tests
global.crypto = {
  getRandomValues: (buffer) => {
    return require('crypto').randomFillSync(buffer);
  }
};

// Mock sessionStorage for tests
global.sessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Increase test timeout
jest.setTimeout(10000); 