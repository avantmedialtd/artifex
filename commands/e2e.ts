import { runE2eTests } from '../scripts/e2e_tests.ts';

/**
 * Handle the 'e2e' command.
 * Runs e2e tests directly with any provided arguments.
 *
 * @param args - Arguments to pass through to the test runner
 * @returns Exit code from the test runner
 */
export async function handleE2e(args: string[]): Promise<number> {
    return await runE2eTests(args);
}
