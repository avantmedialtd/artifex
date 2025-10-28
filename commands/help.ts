import { header, section, listItem, info, error } from '../utils/output.ts';

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
            'zap spec archive my-change-id       # Archive a change',
        ],
    },
    propose: {
        description: 'Create a new OpenSpec proposal (shorthand for "spec propose")',
        usage: 'zap propose <proposal-text>',
        examples: ['zap propose "Add dark mode support"'],
    },
    archive: {
        description: 'Archive an OpenSpec change (shorthand for "spec archive")',
        usage: 'zap archive <spec-id>',
        examples: ['zap archive my-change-id'],
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
    listItem('spec archive <id>      Archive an OpenSpec change');
    listItem('propose <text>         Shorthand for "spec propose"');
    listItem('archive <id>           Shorthand for "spec archive"');
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
