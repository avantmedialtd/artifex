import { header, section, listItem, error } from '../utils/output.ts';

/**
 * Help content for all commands
 */
const HELP_CONTENT: Record<string, { description: string; usage: string; examples?: string[] }> = {
    npm: {
        description: 'Manage npm packages',
        usage: 'af npm upgrade',
        examples: ['af npm upgrade  # Upgrade all outdated npm packages'],
    },
    spec: {
        description: 'Manage OpenSpec changes',
        usage: 'af spec <subcommand> [args]',
        examples: [
            'af spec propose "Add new feature"  # Create a new proposal',
            'af spec apply my-change-id         # Apply a change',
            'af spec apply                      # Interactively select a change',
            'af spec archive my-change-id       # Archive a change',
            'af spec archive                    # Interactively select a spec',
        ],
    },
    propose: {
        description: 'Create a new OpenSpec proposal (shorthand for "spec propose")',
        usage: 'af propose <proposal-text>',
        examples: ['af propose "Add dark mode support"'],
    },
    apply: {
        description: 'Apply an approved OpenSpec change (shorthand for "spec apply")',
        usage: 'af apply [change-id]',
        examples: [
            'af apply my-change-id  # Apply a specific change',
            'af apply               # Interactively select a change',
        ],
    },
    archive: {
        description: 'Archive an OpenSpec change (shorthand for "spec archive")',
        usage: 'af archive [spec-id]',
        examples: [
            'af archive my-change-id  # Archive a specific spec',
            'af archive               # Interactively select a spec',
        ],
    },
    commit: {
        description: 'Commit all changes with a message referencing the OpenSpec change title',
        usage: 'af commit [apply] [change-id]',
        examples: [
            'af commit my-change-id       # Commit with message "Apply: <title>"',
            'af commit                    # Interactively select a change',
            'af commit apply my-change-id # Same as "af commit my-change-id"',
            'af commit apply              # Interactively select a change',
        ],
    },
    changes: {
        description: 'List all OpenSpec changes',
        usage: 'af changes',
        examples: ['af changes  # Show all active OpenSpec changes'],
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
    jira: {
        description: 'Manage Jira issues from the command line',
        usage: 'af jira <subcommand> [args] [options]',
        examples: [
            'af jira get PROJ-123              # Get issue details',
            'af jira list PROJ --limit 20     # List project issues',
            'af jira search "status = Open"   # Search with JQL',
            'af jira create --project PROJ --type Bug --summary "Title"',
            'af jira projects                  # List all projects',
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
    header('af - Development utility CLI');

    section('USAGE');
    console.log('  af <command> [options]');

    section('COMMANDS');
    listItem('npm upgrade            Upgrade all outdated npm packages');
    listItem('spec propose <text>    Create a new OpenSpec proposal');
    listItem('spec apply [id]        Apply an approved OpenSpec change');
    listItem('spec archive [id]      Archive an OpenSpec change');
    listItem('propose <text>         Shorthand for "spec propose"');
    listItem('apply [id]             Shorthand for "spec apply"');
    listItem('archive [id]           Shorthand for "spec archive"');
    listItem('commit [apply] [id]    Commit all changes with "Apply: <title>"');
    listItem('changes                List all OpenSpec changes');
    listItem('todo                   Show all TODO items from active changes');
    listItem('watch                  Continuously show updated TODO items (with idle indicator)');
    listItem('versions reset         Reset version worktrees to HEAD');
    listItem('versions push          Force push version worktrees');
    listItem('jira <subcommand>      Manage Jira issues (get, list, create, etc.)');
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
    const helpInfo = HELP_CONTENT[command];

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
