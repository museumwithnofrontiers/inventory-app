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
    testTimeout: 30000, // Increase timeout to 30 seconds
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid overwhelming the API
      },
    },
    // Only include integration tests and resource integration tests
    include: [
      '**/*.integration.test.ts',
      '**/integration/**/*.test.ts',
      '**/resource_integration/**/*.tests.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/vendor/**',
      '**/storage/**',
      '**/bootstrap/cache/**',
      '**/feature/**/*.test.ts',
      '**/logic/**/*.test.ts', 
      '**/consistency/**/*.test.ts',
    ],
    setupFiles: ['./resources/js/api/__tests__/integration.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
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
        'resources/js/__tests__/feature/**',
        'resources/js/__tests__/logic/**', 
        'resources/js/__tests__/consistency/**',
        '**/__tests__/**',
        '**/test-utils.ts',
      ],
    },
  },
})
