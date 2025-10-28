import { spawn } from 'node:child_process';
import { getOutdatedPackages, upgradeAllPackages } from './npm-upgrade.ts';
import {
    getCurrentHeadCommit,
    hasUncommittedChanges,
    isGitRepository,
    listWorktrees,
    resetWorktree,
} from './git-worktree.ts';

// Parse command-line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('zap CLI ready');
    process.exit(0);
}

const [command, subcommand] = args;

if (command === 'npm') {
    if (subcommand === 'upgrade') {
        await runNpmUpgrade();
    } else if (!subcommand) {
        console.error('Error: npm command requires a subcommand (e.g., upgrade)');
        process.exit(1);
    } else {
        console.error(`Error: Unknown npm subcommand: ${subcommand}`);
        process.exit(1);
    }
} else if (command === 'spec') {
    if (subcommand === 'archive') {
        const specId = args[2];
        await runSpecArchive(specId);
    } else if (subcommand === 'propose') {
        const proposalText = args.slice(2).join(' ');
        await runSpecPropose(proposalText);
    } else if (!subcommand) {
        console.error('Error: spec command requires a subcommand (e.g., archive)');
        process.exit(1);
    } else {
        console.error(`Error: Unknown spec subcommand: ${subcommand}`);
        process.exit(1);
    }
} else if (command === 'propose') {
    const proposalText = args.slice(1).join(' ');
    await runSpecPropose(proposalText);
} else if (command === 'archive') {
    const specId = args[1];
    await runSpecArchive(specId);
} else if (command === 'versions') {
    if (subcommand === 'reset') {
        await runVersionsReset();
    } else if (!subcommand) {
        console.error('Error: versions command requires a subcommand (e.g., reset)');
        process.exit(1);
    } else {
        console.error(`Error: Unknown versions subcommand: ${subcommand}`);
        process.exit(1);
    }
} else {
    console.error(`Error: Unknown command: ${command}`);
    process.exit(1);
}

async function runNpmUpgrade() {
    try {
        console.log('Checking for outdated packages...');

        const outdatedPackages = await getOutdatedPackages();

        if (outdatedPackages.length === 0) {
            console.log('All packages are up to date!');
            process.exit(0);
        }

        console.log(`\nFound ${outdatedPackages.length} package(s) to upgrade:`);
        outdatedPackages.forEach(pkg => console.log(`  - ${pkg}`));
        console.log('');

        const results = await upgradeAllPackages(outdatedPackages);

        // Display summary
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        console.log('\n' + '='.repeat(50));
        console.log('Upgrade Summary');
        console.log('='.repeat(50));
        console.log(`Successfully upgraded: ${successful.length} package(s)`);

        if (successful.length > 0) {
            successful.forEach(r => console.log(`  ✓ ${r.package}`));
        }

        if (failed.length > 0) {
            console.log(`\nFailed to upgrade: ${failed.length} package(s)`);
            failed.forEach(r => console.log(`  ✗ ${r.package}: ${r.error}`));
            process.exit(1);
        }

        console.log('\nAll packages upgraded successfully!');
        process.exit(0);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
        } else {
            console.error('An unexpected error occurred');
        }
        process.exit(1);
    }
}

async function runSpecArchive(specId: string | undefined) {
    // Validate that specId is provided
    if (!specId) {
        console.error('Error: spec archive requires a spec-id argument');
        console.error('Usage: zap spec archive <spec-id>');
        process.exit(1);
    }

    // Check if Claude Code is available
    const isClaudeAvailable = await checkClaudeAvailable();
    if (!isClaudeAvailable) {
        console.error('Error: Claude Code CLI is not installed or not in PATH');
        console.error('Please install Claude Code from: https://claude.com/claude-code');
        process.exit(1);
    }

    // Build and execute the claude command
    const claudeArgs = [
        '-p',
        '--include-partial-messages',
        '--permission-mode',
        'acceptEdits',
        `/openspec:archive ${specId}`,
    ];
    const claudeProcess = spawn('claude', claudeArgs, {
        stdio: 'inherit', // Pipe stdout, stderr, and stdin to parent process
    });

    // Wait for the process to complete and exit with its status code
    claudeProcess.on('close', code => {
        process.exit(code ?? 1);
    });

    claudeProcess.on('error', error => {
        console.error(`Error executing claude command: ${error.message}`);
        process.exit(1);
    });
}

async function runSpecPropose(proposalText: string) {
    // Validate that proposalText is provided
    if (!proposalText || proposalText.trim() === '') {
        console.error('Error: spec propose requires proposal text');
        console.error('Usage: zap spec propose <proposal-text>');
        process.exit(1);
    }

    // Check if Claude Code is available
    const isClaudeAvailable = await checkClaudeAvailable();
    if (!isClaudeAvailable) {
        console.error('Error: Claude Code CLI is not installed or not in PATH');
        console.error('Please install Claude Code from: https://claude.com/claude-code');
        process.exit(1);
    }

    // Build and execute the claude command
    const claudeArgs = ['--permission-mode', 'acceptEdits', `/openspec:proposal ${proposalText}`];
    const claudeProcess = spawn('claude', claudeArgs, {
        stdio: 'inherit', // Pipe stdout, stderr, and stdin to parent process
    });

    // Wait for the process to complete and exit with its status code
    claudeProcess.on('close', code => {
        process.exit(code ?? 1);
    });

    claudeProcess.on('error', error => {
        console.error(`Error executing claude command: ${error.message}`);
        process.exit(1);
    });
}

async function checkClaudeAvailable(): Promise<boolean> {
    return new Promise(resolve => {
        const checkProcess = spawn('claude', ['--version'], {
            stdio: 'ignore', // Suppress output
        });

        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
            checkProcess.kill();
            resolve(false);
        }, 3000); // 3 second timeout

        checkProcess.on('close', code => {
            clearTimeout(timeout);
            resolve(code === 0);
        });

        checkProcess.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
}

/**
 * Resets all version worktrees (matching /v\d+/ pattern) to the current branch HEAD.
 *
 * Usage: zap versions reset
 *
 * This command:
 * 1. Validates the current directory is a git repository
 * 2. Gets the current HEAD commit hash
 * 3. Enumerates all worktrees and filters those with branches matching /v\d+/
 * 4. Checks each matching worktree for uncommitted changes
 * 5. If all worktrees are clean, resets each to the current HEAD
 * 6. Reports progress and results
 *
 * @throws Exits with code 1 if:
 *   - Not in a git repository
 *   - Any worktree has uncommitted changes
 *   - Git commands fail
 */
async function runVersionsReset() {
    try {
        // 1. Validate we're in a git repository
        if (!isGitRepository()) {
            console.error('Error: Not in a git repository');
            process.exit(1);
        }

        // 2. Get current HEAD commit
        const targetRevision = getCurrentHeadCommit();

        // 3. Enumerate worktrees and filter by /v\d+/ pattern
        const allWorktrees = listWorktrees();
        const versionPattern = /^v\d+$/;
        const matchingWorktrees = allWorktrees.filter(wt => versionPattern.test(wt.branch));

        // Handle case where no matching worktrees are found
        if (matchingWorktrees.length === 0) {
            console.log('No worktrees with branches matching /v\\d+/ pattern found.');
            process.exit(0);
        }

        // 4. Check each worktree for uncommitted changes
        const worktreesWithChanges: string[] = [];
        for (const worktree of matchingWorktrees) {
            try {
                if (hasUncommittedChanges(worktree.path)) {
                    worktreesWithChanges.push(worktree.branch);
                }
            } catch (error) {
                if (error instanceof Error) {
                    console.error(error.message);
                } else {
                    console.error(`Failed to check worktree '${worktree.branch}'`);
                }
                process.exit(1);
            }
        }

        // 5. If any worktree has uncommitted changes, report and exit
        if (worktreesWithChanges.length > 0) {
            console.error('Error: Cannot reset worktrees with uncommitted changes');
            for (const worktree of matchingWorktrees) {
                if (worktreesWithChanges.includes(worktree.branch)) {
                    console.error(
                        `Worktree '${worktree.branch}' at ${worktree.path} has uncommitted changes`,
                    );
                }
            }
            console.error('\nPlease commit or stash changes and try again.');
            console.error('You can check the status by running: git status');
            process.exit(1);
        }

        // 6. Reset each worktree
        for (const worktree of matchingWorktrees) {
            console.log(`Resetting worktree ${worktree.branch}...`);
            try {
                resetWorktree(worktree.path, targetRevision);
            } catch (error) {
                if (error instanceof Error) {
                    console.error(error.message);
                } else {
                    console.error(`Failed to reset worktree '${worktree.branch}'`);
                }
                process.exit(1);
            }
        }

        // 7. Display success summary
        const branchNames = matchingWorktrees.map(wt => wt.branch).join(', ');
        console.log(`Successfully reset ${matchingWorktrees.length} worktree(s): ${branchNames}`);
        process.exit(0);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
        } else {
            console.error('An unexpected error occurred');
        }
        process.exit(1);
    }
}
