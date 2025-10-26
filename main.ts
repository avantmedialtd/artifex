import { getOutdatedPackages, upgradeAllPackages } from './npm-upgrade.ts';
import { spawn } from 'node:child_process';

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
    const claudeArgs = ['--permission-mode', 'acceptEdits', `/openspec:archive ${specId}`];
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
