/**
 * Global polyfills for Node.js compatibility
 * This file must be imported FIRST in main.ts before any other modules
 */
import { webcrypto } from 'node:crypto';

// Polyfill global crypto for libraries that expect Web Crypto API
// Some libraries (like @nestjs/typeorm) expect crypto to be globally available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(global as any).crypto) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).crypto = webcrypto;
}
