// @ts-nocheck
/**
 * E2E Test Runner
 *
 * Runs Playwright E2E tests in a fresh Docker environment with full isolation.
 * Pass a full shell command to run inside the e2e container.
 *
 * Usage:
 *   af e2e                                    # Run all tests with defaults
 *   af e2e npm run e2e -- --grep "booking"   # Custom command
 *
 * Defaults (when no command provided):
 *   npm run e2e -- --workers 2 --max-failures=1
 *
 * Always appended:
 *   --reporter=./copy-prompt-reporter.ts,html   # AI-friendly + HTML reports
 *
 * Environment:
 *   CI=1                 # Show verbose command output
 *   PROJECT_NAME=name    # Docker Compose project name (for isolation)
 *
 * Output directories:
 *   ./playwright-report/ # HTML report with traces and DOM snapshots
 *   ./test-results/      # Screenshots (viewable via Read tool for AI agents)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { extractResource } from '../utils/resources.ts';

const SHOW_AGENT_DETAILS = !!process.env.CI;
const SHOULD_SHOW_SPINNER = !process.env.CI;

// Module-level args variable, set by runE2eTests or standalone execution
let passThroughArgs: string[] = [];

function composeArgs(args: string[]): string[] {
    const out: string[] = ['compose'];
    const projectName = process.env.PROJECT_NAME;
    if (projectName && projectName.trim().length > 0) {
        out.push('-p', projectName.trim());
    }
    out.push('-f', 'docker-compose.yml');
    out.push('-f', 'docker-compose.test.yml');
    out.push('--profile', 'testing');

    out.push(...args);
    return out;
}

async function compose(
    args: string[],
    opts?: {
        showSpinner?: boolean;
        inheritStdio?: boolean;
        allowFailure?: boolean;
    },
) {
    const fullArgs = composeArgs(args);
    const runOpts: SpawnOpts & { showSpinner?: boolean } = {
        showSpinner: opts?.showSpinner,
        inheritStdio: opts?.inheritStdio,
    };
    if (opts?.allowFailure) {
        return runAllowFailure('docker', fullArgs, runOpts);
    }
    return run('docker', fullArgs, runOpts);
}

const clearPreviousLine = () => {
    process.stdout.write('\x1b[1A\x1b[2K');
};

// Colors for output
const RED = '\u001b[0;31m';
const GREEN = '\u001b[0;32m';
const BLUE = '\u001b[0;34m';
const YELLOW = '\u001b[1;33m';
const GRAY = '\u001b[0;90m';
const BOLD = '\u001b[1m';
const NC = '\u001b[0m';

// Progress tracking
const TOTAL_STEPS = 4;
let CURRENT_STEP = 0;

// Timing
const START_TIME = Date.now();

// Ensure we run from repo root
const repoRoot = process.cwd();

function elapsedSeconds(from: number) {
    return Math.floor((Date.now() - from) / 1000);
}

function formatDuration(seconds: number): string {
    if (seconds < 60) {
        return `${seconds}s`;
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }

    return `${minutes}m ${secs}s`;
}

function logStep(msg: string) {
    CURRENT_STEP += 1;
    const elapsed = elapsedSeconds(START_TIME);
    process.stdout.write(
        `\n${BOLD}${BLUE}[${CURRENT_STEP}/${TOTAL_STEPS}]${NC} ${BOLD}${msg}${NC} ${GRAY}(${formatDuration(
            elapsed,
        )})${NC}\n`,
    );
}

function logInfo(msg: string) {
    process.stdout.write(`  ${BLUE}→${NC} ${msg}\n`);
}

function logSuccess(msg: string) {
    process.stdout.write(`  ${GREEN}✓${NC} ${msg}\n`);
}

function logWarning(msg: string) {
    process.stdout.write(`  ${YELLOW}⚠${NC} ${msg}\n`);
}

function logError(msg: string) {
    process.stdout.write(`  ${RED}✗${NC} ${msg}\n`);
}

type SpawnOpts = {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    inheritStdio?: boolean; // when true, stream child output to current terminal
};

function showSpinnerUntil(child: import('node:child_process').ChildProcess): Promise<number> {
    return new Promise(resolve => {
        const frames = ['|', '/', '-', '\\'];
        let i = 0;
        const timer = setInterval(() => {
            const f = frames[i++ % frames.length];
            process.stdout.write(` [${f}]  `);
            // backspaces to erase spinner
            process.stdout.write('\b\b\b\b\b\b');
        }, 100);

        const finish = (code: number | null) => {
            clearInterval(timer);
            // Clear remaining spinner chars
            process.stdout.write('    \b\b\b\b');
            resolve(code ?? 0);
        };

        child.on('error', () => finish(1));
        child.on('close', code => finish(code));
        child.on('exit', code => finish(code));
    });
}

function run(
    cmd: string,
    args: string[],
    opts: SpawnOpts & { showSpinner?: boolean } = {},
): Promise<number> {
    return new Promise((resolve, reject) => {
        if (SHOW_AGENT_DETAILS) {
            console.log(
                `Running command: ${cmd} ${args
                    .map(a => (a.includes(' ') ? `"${a}"` : a))
                    .join(' ')}`,
            );
        }

        const child = spawn(cmd, args, {
            cwd: opts.cwd ?? process.cwd(),
            env: opts.env ?? process.env,
            stdio: opts.inheritStdio ? 'inherit' : 'ignore',
        });

        if (opts.showSpinner) {
            showSpinnerUntil(child).then(code => {
                if (code === 0) resolve(0);
                else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
            });
        } else {
            child.on('error', err => reject(err));
            child.on('close', code => {
                if (code === 0) resolve(0);
                else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
            });
        }
    });
}

function runAllowFailure(
    cmd: string,
    args: string[],
    opts: SpawnOpts & { showSpinner?: boolean } = {},
): Promise<number> {
    if (SHOW_AGENT_DETAILS) {
        console.log(
            `Running command: ${cmd} ${args.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`,
        );
    }

    return new Promise(resolve => {
        const child = spawn(cmd, args, {
            cwd: opts.cwd ?? process.cwd(),
            env: opts.env ?? process.env,
            stdio: opts.inheritStdio ? 'inherit' : 'ignore',
        });
        const finish = (code: number | null) => resolve(code ?? 0);

        if (opts.showSpinner) {
            showSpinnerUntil(child).then(code => finish(code));
        } else {
            child.on('error', () => finish(1));
            child.on('close', code => finish(code));
            child.on('exit', code => finish(code));
        }
    });
}

export async function runE2eTests(args: string[]): Promise<number> {
    passThroughArgs = args;
    // Welcome message
    process.stdout.write(`\n${BOLD}${BLUE}🔬 End to end tests${NC}\n`);
    process.stdout.write(
        `${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n`,
    );

    // Step 1: Environment setup
    logStep('Setting up fresh environment');
    logInfo('Tearing down existing containers');
    await compose(['down', '-v'], { allowFailure: true });

    clearPreviousLine();
    logSuccess('Cleaned up existing environment');

    if (process.env.CLEAN_DOCKER_VOLUMES === '1') {
        logInfo('Pruning cached Docker images');
        // Prune only images from this compose project (uses PROJECT_NAME or directory name)
        const composeProjectName = process.env.PROJECT_NAME?.trim() || path.basename(repoRoot);
        await run(
            'docker',
            [
                'image',
                'prune',
                '-f',
                '--filter',
                `label=com.docker.compose.project=${composeProjectName}`,
            ],
            { showSpinner: SHOULD_SHOW_SPINNER },
        );

        clearPreviousLine();
        logSuccess('Docker image cache cleared');
    }

    logInfo('Building and starting services');
    await compose(['up', '-d', '--build', '--wait'], {
        inheritStdio: true,
    });

    clearPreviousLine();
    logSuccess('All services ready');

    // Copy reporter to container
    logInfo('Copying test reporter to container');
    const tempReporterPath = path.join(tmpdir(), 'copy-prompt-reporter.ts');
    try {
        await extractResource('copy-prompt-reporter.ts', tempReporterPath);
        const copyReporterCode = await compose(
            ['cp', tempReporterPath, 'e2e:/workspace/copy-prompt-reporter.ts'],
            { allowFailure: false },
        );
        if (copyReporterCode !== 0) {
            throw new Error(`docker compose cp failed with exit code ${copyReporterCode}`);
        }
        clearPreviousLine();
        logSuccess('Test reporter copied to container');
    } catch (err) {
        logError(`Failed to copy test reporter: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
    }

    // Step 2: Run E2E tests
    logStep('Running E2E tests');
    logInfo('Executing Playwright test suite');
    if (passThroughArgs.length > 0) {
        logInfo(`Command: ${passThroughArgs.join(' ')}`);
    }
    const TEST_START = Date.now();

    // Build test command - reporter is always appended
    const REPORTER = '--reporter=./copy-prompt-reporter.ts,html';
    let testCommand: string;
    if (passThroughArgs.length > 0) {
        testCommand = `${passThroughArgs.join(' ')} ${REPORTER}`;
    } else {
        testCommand = `npm run e2e -- --workers 2 --max-failures=1 ${REPORTER}`;
    }

    // We allow failure to capture exit code without throwing
    const e2eExitCode = await compose(['exec', '-T', 'e2e', 'sh', '-c', testCommand], {
        inheritStdio: true,
        allowFailure: true,
    });
    const TEST_DURATION = elapsedSeconds(TEST_START);

    if (e2eExitCode === 0) {
        logSuccess(`All tests passed (${formatDuration(TEST_DURATION)})`);
    } else {
        logError(`Tests completed with failures (${formatDuration(TEST_DURATION)})`);
        const dockerArgsStr = composeArgs(['logs', '--no-color']).join(' ');
        await runAllowFailure('sh', ['-c', `docker ${dockerArgsStr} > docker.log 2>&1`]);
        logInfo('Logs saved to docker.log');
    }

    // Step 3: Generate test report
    logStep('Generating test report');
    logInfo('Copying Playwright report and test results');

    try {
        fs.rmSync('./playwright-report', { recursive: true, force: true });
        fs.rmSync('./test-results', { recursive: true, force: true });
    } catch {
        // ignore
    }

    const copyCode = await compose(
        ['cp', 'e2e:/workspace/playwright-report', './playwright-report'],
        {
            allowFailure: true,
        },
    );
    if (copyCode === 0) {
        logSuccess('Test report saved to ./playwright-report');
        if (fs.existsSync('./playwright-report/index.html')) {
            logSuccess('HTML report available: ./playwright-report/index.html');
        }
    } else {
        logWarning('Could not copy test report');
    }

    // Copy test-results (screenshots, traces) for AI agent access
    const copyResultsCode = await compose(['cp', 'e2e:/workspace/test-results', './test-results'], {
        allowFailure: true,
    });
    if (copyResultsCode === 0 && fs.existsSync('./test-results')) {
        logSuccess('Test results (screenshots/traces) saved to ./test-results');
    }

    // Step 4: Summary
    logStep('Test run complete');
    const TOTAL_DURATION = elapsedSeconds(START_TIME);

    logInfo('Tearing down existing containers');
    process.stdout.write('\b'.repeat('Tearing down existing containers'.length + 2));

    await compose(['down', '-v'], { allowFailure: true });

    process.stdout.write(`\n${BOLD}${BLUE}📊 Test Summary${NC}\n`);
    process.stdout.write(
        `${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n`,
    );

    if (e2eExitCode === 0) {
        process.stdout.write(`  ${GREEN}✓${NC} ${BOLD}All tests passed${NC}\n`);
        process.stdout.write(`  ${GRAY}→${NC} Total time: ${formatDuration(TOTAL_DURATION)}\n`);
        process.stdout.write(`  ${GRAY}→${NC} Test time: ${formatDuration(TEST_DURATION)}\n`);
        process.stdout.write(`\n${GREEN}🎉 E2E tests completed successfully!${NC}\n`);
    } else {
        process.stdout.write(`  ${RED}✗${NC} ${BOLD}Tests failed${NC}\n`);
        process.stdout.write(`  ${GRAY}→${NC} Total time: ${formatDuration(TOTAL_DURATION)}\n`);
        process.stdout.write(`  ${GRAY}→${NC} Test time: ${formatDuration(TEST_DURATION)}\n`);
        process.stdout.write(`  ${GRAY}→${NC} Exit code: ${e2eExitCode}\n`);
        if (fs.existsSync('./playwright-report/index.html')) {
            process.stdout.write(`  ${GRAY}→${NC} HTML report: ./playwright-report/index.html\n`);
        }
        process.stdout.write(`\n${RED}❌ E2E tests failed. Check the report for details.${NC}\n`);
    }

    process.stdout.write('\n');
    return e2eExitCode;
}

// Ensure we attempt to tear down on Ctrl+C
process.on('SIGINT', async () => {
    try {
        await compose(['down', '-v'], { allowFailure: true });
    } finally {
        process.exit(130);
    }
});

// Standalone execution for direct script usage
if (import.meta.main) {
    runE2eTests(process.argv.slice(2))
        .then(code => process.exit(code))
        .catch(err => {
            logError(err?.message ?? String(err));
            // best-effort teardown
            compose(['down', '-v'], { allowFailure: true }).finally(() => process.exit(1));
        });
}
