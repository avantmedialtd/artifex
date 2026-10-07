import { header, section, listItem, error } from '../utils/output.ts';
import { getVersion } from '../utils/version.ts';
import { showBitbucketHelp } from './bitbucket.ts';
import { showConfluenceHelp } from './confluence.ts';
import { showJiraHelp } from './jira.ts';

/**
 * Products whose full reference lives with their command handler, so that
 * `af help <product>` and `af <product> --help` print the same text.
 */
const PRODUCT_HELP: Record<string, () => void> = {
    jira: showJiraHelp,
    confluence: showConfluenceHelp,
    bitbucket: showBitbucketHelp,
    bb: showBitbucketHelp,
};

/**
 * Help content for all commands
 */
const HELP_CONTENT: Record<string, { description: string; usage: string; examples?: string[] }> = {
    npm: {
        description: 'Manage npm packages',
        usage: 'af npm upgrade',
        examples: ['af npm upgrade  # Upgrade all outdated npm packages'],
    },
    bun: {
        description: 'Manage Bun packages',
        usage: 'af bun upgrade',
        examples: ['af bun upgrade  # Upgrade all outdated Bun packages'],
    },
    changes: {
        description: 'List all OpenSpec changes',
        usage: 'af changes',
        examples: ['af changes  # Show all active OpenSpec changes'],
    },
    e2e: {
        description: 'Run E2E tests in a fresh Docker environment',
        usage: 'af e2e [args...]',
        examples: [
            'af e2e                                        # Run all tests with defaults',
            'af e2e npm run e2e -- --grep "booking"   # Custom command',
        ],
    },
    'stop-hook': {
        description: 'Conditionally run e2e tests if relevant files changed',
        usage: 'af stop-hook',
        examples: ['af stop-hook  # Run e2e only if source files changed (not just openspec/)'],
    },
    todo: {
        description: 'Show all TODO items from active OpenSpec changes',
        usage: 'af todo',
        examples: ['af todo  # Display all tasks from active changes'],
    },
    watch: {
        description:
            'Continuously monitor and display TODO items from active changes with idle indicator',
        usage: 'af watch',
        examples: [
            'af watch  # Start watch mode for real-time TODO updates',
            '          # Shows idle warning after 60 seconds of inactivity',
        ],
    },
    versions: {
        description: 'Manage version worktrees',
        usage: 'af versions <subcommand>',
        examples: [
            'af versions reset  # Reset all version worktrees to HEAD',
            'af versions push   # Force push all version worktrees',
        ],
    },
    jenkins: {
        description: 'Read-only Jenkins build visibility',
        usage: 'af jenkins <subcommand> [args] [options]',
        examples: [
            'af jenkins jobs                              # List all jobs',
            'af jenkins branches my-pipeline              # List branch build statuses',
            'af jenkins build my-app/main                 # Latest build info',
            'af jenkins log my-app/main                   # Latest build console output',
            'af jenkins stages my-app/main                # Pipeline stage breakdown',
            'af jenkins stage-log my-app/main "Test"      # Log for a specific stage',
            'af jenkins queue                             # Show build queue',
        ],
    },
    sonar: {
        description:
            'Read-only SonarQube inspection for pull request quality gates, issues, and measures',
        usage: 'af sonar <subcommand> [args] [options]',
        examples: [
            'af sonar pr 42                  # Gate + top issues + measures for PR 42',
            'af sonar pr                     # Auto-detect PR from current branch',
            'af sonar pr 42 --issues         # Full new-issues list for PR 42',
            'af sonar gate                   # Main branch quality gate',
            'af sonar prs                    # PRs SonarQube has analyzed',
            'af sonar pr 42 --json           # Raw JSON for scripting',
        ],
    },
    worktree: {
        description: 'Manage git worktrees',
        usage: 'af worktree <subcommand> [args]',
        examples: [
            'af worktree new feature-x        # Create worktree with new branch',
            'af worktree new hotfix --detach  # Create worktree with detached HEAD',
            'af worktree reset                # Reset current worktree to HEAD',
            'af worktree reset feature-x      # Reset named worktree to HEAD',
        ],
    },
    help: {
        description: 'Display help information',
        usage: 'af help [command]',
        examples: ['af help        # Show all commands', 'af help npm    # Show npm help'],
    },
};

/**
 * Display general help showing all available commands.
 */
function showGeneralHelp(): void {
    console.log(`af v${getVersion()}`);
    header('Development utility CLI');

    section('USAGE');
    console.log('  af <command> [options]');

    section('COMMANDS');
    listItem('npm upgrade            Upgrade all outdated npm packages');
    listItem('bun upgrade            Upgrade all outdated Bun packages');
    listItem('changes                List all OpenSpec changes');
    listItem('e2e [args...]          Run E2E tests in Docker');
    listItem('stop-hook              Run e2e only if relevant files changed');
    listItem('todo                   Show all TODO items from active changes');
    listItem('watch                  Continuously show updated TODO items (with idle indicator)');
    listItem('versions reset         Reset version worktrees to HEAD');
    listItem('versions push          Force push version worktrees');
    listItem('jenkins <subcommand>   Jenkins build visibility (jobs, builds, logs, etc.)');
    listItem('jira <subcommand>      Manage Jira issues (get, list, create, etc.)');
    listItem('confluence <sub>      Manage Confluence pages (get, list, create, etc.)');
    listItem('bitbucket <sub>       Manage Bitbucket PRs, comments, tasks, pipelines (alias: bb)');
    listItem('sonar <subcommand>     SonarQube quality gate visibility for PRs');
    listItem('worktree new <name>    Create new worktree with env files');
    listItem('worktree reset [name]  Reset worktree to HEAD');
    listItem('help [command]         Show help for a command');

    section('OPTIONS');
    listItem('--help, -h            Show help information');

    console.log("\nRun 'af help <command>' for more information on a command.");
}

/**
 * Display help for a specific command.
 *
 * @param command - The command to show help for
 */
function showCommandHelp(command: string): void {
    // Own keys only, so names like __proto__ or valueOf are unknown commands.
    if (Object.hasOwn(PRODUCT_HELP, command)) {
        PRODUCT_HELP[command]();
        return;
    }

    const helpInfo = Object.hasOwn(HELP_CONTENT, command) ? HELP_CONTENT[command] : undefined;

    if (!helpInfo) {
        error(`Unknown command: ${command}`);
        console.log("\nRun 'af help' to see all available commands.");
        return;
    }

    header(`af ${command}`);

    section('DESCRIPTION');
    console.log(`  ${helpInfo.description}`);

    section('USAGE');
    console.log(`  ${helpInfo.usage}`);

    if (helpInfo.examples && helpInfo.examples.length > 0) {
        section('EXAMPLES');
        helpInfo.examples.forEach(example => console.log(`  ${example}`));
    }
}

/**
 * Handle the 'help' command.
 * Displays general help or command-specific help.
 *
 * @param command - Optional command to show help for
 * @returns Exit code (always 0)
 */
export async function handleHelp(command?: string): Promise<number> {
    if (command) {
        showCommandHelp(command);
    } else {
        showGeneralHelp();
    }
    return 0;
}
