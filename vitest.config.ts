import {defineConfig} from 'vitest/config';

// Separate from vite.config.ts: the widget build plugins (entry discovery, upload) are not needed for unit tests.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
