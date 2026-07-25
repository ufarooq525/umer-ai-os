import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Eng gate fixture and server.test both touch skip-run env; keep files sequential.
    fileParallelism: false,
  },
});
