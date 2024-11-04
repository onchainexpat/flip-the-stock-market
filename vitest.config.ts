import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        '**.js',
        '**.ts',
        '**/**.stories.**',
        '**/*Svg.tsx',
        '**/types.ts',
        '.next/**',
        'public/**',
        'node_modules/**',
      ],
      reportOnFailure: true,
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '.next/**', 'public/**'],
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
});
