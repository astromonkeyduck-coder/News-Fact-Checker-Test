/**
 * Jest setup file for Games Gallery tests
 */

// Mock window.analytics if it doesn't exist
if (typeof window !== 'undefined') {
  window.analytics = window.analytics || {
    track: jest.fn(),
  };
}

// Suppress console errors in tests (optional)
// const originalError = console.error;
// beforeAll(() => {
//   console.error = (...args) => {
//     if (
//       typeof args[0] === 'string' &&
//       args[0].includes('Warning: ReactDOM.render')
//     ) {
//       return;
//     }
//     originalError.call(console, ...args);
//   };
// });
// afterAll(() => {
//   console.error = originalError;
// });

