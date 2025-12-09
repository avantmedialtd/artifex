import { header, section, listItem, error } from '../utils/output.ts';

/**
 * Help content for all commands
 */
const HELP_CONTENT: Record<string, { description: string; usage: string; examples?: string[] }> = {
    npm: {
        description: 'Manage npm packages',
        usage: 'zap npm upgrade',
        examples: ['zap npm upgrade  # Upgrade all outdated npm packages'],
    },
    spec: {
        description: 'Manage OpenSpec changes',
        usage: 'zap spec <subcommand> [args]',
        examples: [
            'zap spec propose "Add new feature"  # Create a new proposal',
            'zap spec apply my-change-id         # Apply a change',
            'zap spec apply                      # Interactively select a change',
            'zap spec archive my-change-id       # Archive a change',
            'zap spec archive                    # Interactively select a spec',
        ],
    },
    propose: {
        description: 'Create a new OpenSpec proposal (shorthand for "spec propose")',
        usage: 'zap propose <proposal-text>',
        examples: ['zap propose "Add dark mode support"'],
    },
    apply: {
        description: 'Apply an approved OpenSpec change (shorthand for "spec apply")',
        usage: 'zap apply [change-id]',
        examples: [
            'zap apply my-change-id  # Apply a specific change',
            'zap apply               # Interactively select a change',
        ],
    },
    archive: {
        description: 'Archive an OpenSpec change (shorthand for "spec archive")',
        usage: 'zap archive [spec-id]',
        examples: [
            'zap archive my-change-id  # Archive a specific spec',
            'zap archive               # Interactively select a spec',
        ],
    },
    commit: {
        description: 'Commit all changes with a message referencing the OpenSpec change title',
        usage: 'zap commit [apply] [change-id]',
        examples: [
            'zap commit my-change-id       # Commit with message "Apply: <title>"',
            'zap commit                    # Interactively select a change',
            'zap commit apply my-change-id # Same as "zap commit my-change-id"',
            'zap commit apply              # Interactively select a change',
        ],
    },
    changes: {
        description: 'List all OpenSpec changes',
        usage: 'zap changes',
        examples: ['zap changes  # Show all active OpenSpec changes'],
    },
    todo: {
        description: 'Show all TODO items from active OpenSpec changes',
        usage: 'zap todo',
        examples: ['zap todo  # Display all tasks from active changes'],
    },
    watch: {
        description:
            'Continuously monitor and display TODO items from active changes with idle indicator',
        usage: 'zap watch',
        examples: [
            'zap watch  # Start watch mode for real-time TODO updates',
            '          # Shows idle warning after 60 seconds of inactivity',
        ],
    },
    versions: {
        description: 'Manage version worktrees',
        usage: 'zap versions <subcommand>',
        examples: [
            'zap versions reset  # Reset all version worktrees to HEAD',
            'zap versions push   # Force push all version worktrees',
        ],
    },
    help: {
        description: 'Display help information',
        usage: 'zap help [command]',
        examples: ['zap help        # Show all commands', 'zap help npm    # Show npm help'],
    },
};

/**
 * Display general help showing all available commands.
 */
function showGeneralHelp(): void {
    header('zap - Development utility CLI');

    section('USAGE');
    console.log('  zap <command> [options]');

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
    listItem('help [command]         Show help for a command');

    section('OPTIONS');
    listItem('--help, -h            Show help information');

    console.log("\nRun 'zap help <command>' for more information on a command.");
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
        console.log("\nRun 'zap help' to see all available commands.");
        return;
    }

    header(`zap ${command}`);

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
