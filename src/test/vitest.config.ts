import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/test/**/*.test.ts',
      'src/test/**/*.test.tsx',
      'src/components/**/*.test.tsx',
    ],
    exclude: ['node_modules', 'dist', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/test/**',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.d.ts',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    timeout: 30000, // 30 seconds for E2E tests
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../'),
      '@/components': resolve(__dirname, '../../components'),
      '@/utils': resolve(__dirname, '../../utils'),
      '@/services': resolve(__dirname, '../../services'),
      '@/hooks': resolve(__dirname, '../../hooks'),
      '@/contracts': resolve(__dirname, '../../contracts'),
      '@/lib': resolve(__dirname, '../../lib'),
    },
  },
});
