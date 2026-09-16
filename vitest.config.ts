import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
    },
  },
  define: {
    global: 'globalThis',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    watch: false,
    // Only exclude tests that require a real backend (those with .integration.test.ts suffix)
    // Tests in integration/ and resource_integration/ folders use mocks and can run in CI
    exclude: [
      '**/node_modules/**',
      'node_modules/**',
      '**/dist/**',
      '**/vendor/**',
      'vendor/**',
      '**/storage/**',
      '**/bootstrap/cache/**',
      '**/*.integration.test.ts', // Only exclude real API integration tests
    ],
    // Explicitly include only our test files
    include: [
      'resources/js/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Exclude only real API integration tests from coverage
      exclude: [
        'node_modules/**',
        'dist/**',
        'vendor/**',
        'storage/**',
        'bootstrap/**',
        'scripts/**',
        'docs/**',
        '.github/**',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '**/*.integration.test.ts', // Only exclude real API integration tests
        'resources/js/__tests__/**',
        '**/__tests__/**',
        '**/test-utils.ts',
      ],
      // Only include src files for coverage
      include: ['resources/js/**/*.{ts,vue}'],
      // Coverage thresholds disabled
      thresholds: {
        global: {
          lines: 0,
          functions: 0,
          branches: 0,
          statements: 0,
        },
      },
    },
    setupFiles: ['./vitest.setup.ts', './resources/js/__tests__/test-utils.ts'],
  },
})
