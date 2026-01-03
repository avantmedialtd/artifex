import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        // Run tests sequentially to avoid spawn conflicts
        fileParallelism: false,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'test/', '**/*.test.ts', '**/*.spec.ts', 'vitest.config.ts'],
        },
    },
});
