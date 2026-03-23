import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', 'dist', '.astro'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/middleware.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
