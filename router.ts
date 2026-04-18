import { handleBunUpgrade } from './commands/bun.ts';
import { handleChanges } from './commands/changes.ts';
import { handleConfluence } from './commands/confluence.ts';
import { handleE2e } from './commands/e2e.ts';
import { handleHelp } from './commands/help.ts';
import { handleJenkins } from './commands/jenkins.ts';
import { handleJira } from './commands/jira.ts';
import { handleNpmUpgrade } from './commands/npm.ts';
import { handleSetup } from './commands/setup.tsx';
import { handleStopHook } from './commands/stop-hook.ts';
import { handleTodo } from './commands/todo.ts';
import { handleVersionsPush, handleVersionsReset } from './commands/versions.ts';
import { handleWatch } from './commands/watch.ts';
import { handleWorktree } from './commands/worktree.ts';
import { error } from './utils/output.ts';

/**
 * Route command-line arguments to the appropriate command handler.
 * Parses the command structure and delegates to command modules.
 *
 * @param args - Command-line arguments (excluding node executable and script path)
 * @returns Exit code (0 for success, 1 for error)
 */
export async function route(args: string[]): Promise<number> {
    // Handle no arguments - show help
    if (args.length === 0) {
        return await handleHelp();
    }

    const [command, subcommand] = args;

    // Handle --help and -h flags
    if (command === '--help' || command === '-h') {
        return await handleHelp();
    }

    // Handle command-specific --help flag
    if (subcommand === '--help' || subcommand === '-h') {
        return await handleHelp(command);
    }

    // Route npm commands
    if (command === 'npm') {
        if (subcommand === 'upgrade') {
            return await handleNpmUpgrade();
        } else if (!subcommand) {
            error('Error: npm command requires a subcommand');
            console.error("Run 'af help npm' for more information.");
            return 1;
        } else {
            error(`Error: Unknown npm subcommand: ${subcommand}`);
            console.error("Run 'af help npm' for available subcommands.");
            return 1;
        }
    }

    // Route bun commands
    if (command === 'bun') {
        if (subcommand === 'upgrade') {
            return await handleBunUpgrade();
        } else if (!subcommand) {
            error('Error: bun command requires a subcommand');
            console.error("Run 'af help bun' for more information.");
            return 1;
        } else {
            error(`Error: Unknown bun subcommand: ${subcommand}`);
            console.error("Run 'af help bun' for available subcommands.");
            return 1;
        }
    }

    if (command === 'changes') {
        // Pass true if any additional arguments were provided
        const hasArgs = args.length > 1;
        return await handleChanges(hasArgs);
    }

    // Route e2e command
    if (command === 'e2e') {
        return await handleE2e(args.slice(1));
    }

    // Route stop-hook command
    if (command === 'stop-hook') {
        return await handleStopHook();
    }

    if (command === 'todo') {
        // Pass true if any additional arguments were provided
        const hasArgs = args.length > 1;
        return await handleTodo(hasArgs);
    }

    if (command === 'watch') {
        // Pass true if any additional arguments were provided
        const hasArgs = args.length > 1;
        return await handleWatch(hasArgs);
    }

    // Route jenkins commands
    if (command === 'jenkins') {
        return await handleJenkins(args.slice(1));
    }

    // Route jira commands
    if (command === 'jira') {
        return await handleJira(args.slice(1));
    }

    // Route confluence commands
    if (command === 'confluence') {
        return await handleConfluence(args.slice(1));
    }

    // Route versions commands
    if (command === 'versions') {
        if (subcommand === 'reset') {
            return await handleVersionsReset();
        } else if (subcommand === 'push') {
            return await handleVersionsPush();
        } else if (!subcommand) {
            error('Error: versions command requires a subcommand');
            console.error("Run 'af help versions' for more information.");
            return 1;
        } else {
            error(`Error: Unknown versions subcommand: ${subcommand}`);
            console.error("Run 'af help versions' for available subcommands.");
            return 1;
        }
    }

    // Route help command
    if (command === 'help') {
        return await handleHelp(subcommand);
    }

    // Route setup command
    if (command === 'setup') {
        return await handleSetup(args.slice(1));
    }

    // Route worktree command
    if (command === 'worktree') {
        return await handleWorktree(args.slice(1));
    }

    // Unknown command
    error(`Error: Unknown command: ${command}`);
    console.error("Run 'af help' to see all available commands.");
    return 1;
}
