import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleScaffold, handleScaffoldTestCompose } from './scaffold.ts';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';

describe('handleScaffold', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('subcommand routing', () => {
        it('should show error when no subcommand provided', () => {
            const exitCode = handleScaffold([]);

            expect(exitCode).toBe(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Run 'af help scaffold' for more information.",
            );
        });

        it('should show error for unknown subcommand', () => {
            const exitCode = handleScaffold(['unknown']);

            expect(exitCode).toBe(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Run 'af help scaffold' for available subcommands.",
            );
        });
    });
});

describe('handleScaffoldTestCompose', () => {
    const outputFile = 'docker-compose.test.yml';

    afterEach(() => {
        // Clean up generated file
        if (existsSync(outputFile)) {
            unlinkSync(outputFile);
        }
        vi.restoreAllMocks();
    });

    describe('file generation', () => {
        it('should create docker-compose.test.yml file', () => {
            const exitCode = handleScaffoldTestCompose();

            expect(exitCode).toBe(0);
            expect(existsSync(outputFile)).toBe(true);
        });

        it('should generate valid compose file content', () => {
            handleScaffoldTestCompose();

            const content = readFileSync(outputFile, 'utf-8');

            // Check for expected content
            expect(content).toContain('# Docker Compose overlay for E2E testing');
            expect(content).toContain('migrate-seed:');
            expect(content).toContain('profiles:');
            expect(content).toContain('- testing');
            expect(content).toContain('restart: "no"');
            expect(content).toContain('condition: service_healthy');
            expect(content).toContain('condition: service_completed_successfully');
            expect(content).toContain('hosting-server:');
            expect(content).toContain('e2e:');
        });

        it('should include usage instructions in comments', () => {
            handleScaffoldTestCompose();

            const content = readFileSync(outputFile, 'utf-8');

            expect(content).toContain(
                'Usage: docker compose -f docker-compose.yml -f docker-compose.test.yml',
            );
        });
    });

    describe('file existence check', () => {
        it('should fail if file already exists', () => {
            // Create file first
            handleScaffoldTestCompose();

            // Try to create again
            const exitCode = handleScaffoldTestCompose();

            expect(exitCode).toBe(1);
        });

        it('should not modify existing file', () => {
            // Create initial file
            handleScaffoldTestCompose();
            const originalContent = readFileSync(outputFile, 'utf-8');

            // Try to create again (should fail)
            handleScaffoldTestCompose();

            // Verify content unchanged
            const currentContent = readFileSync(outputFile, 'utf-8');
            expect(currentContent).toBe(originalContent);
        });
    });
});
