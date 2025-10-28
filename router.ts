import { handleNpmUpgrade } from './commands/npm.ts';
import { handleSpecArchive, handleSpecPropose } from './commands/spec.ts';
import { handleVersionsPush, handleVersionsReset } from './commands/versions.ts';
import { handleHelp } from './commands/help.ts';
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
            console.error("Run 'zap help npm' for more information.");
            return 1;
        } else {
            error(`Error: Unknown npm subcommand: ${subcommand}`);
            console.error("Run 'zap help npm' for available subcommands.");
            return 1;
        }
    }

    // Route spec commands
    if (command === 'spec') {
        if (subcommand === 'archive') {
            const specId = args[2];
            return await handleSpecArchive(specId);
        } else if (subcommand === 'propose') {
            const proposalText = args.slice(2).join(' ');
            return await handleSpecPropose(proposalText);
        } else if (!subcommand) {
            error('Error: spec command requires a subcommand');
            console.error("Run 'zap help spec' for more information.");
            return 1;
        } else {
            error(`Error: Unknown spec subcommand: ${subcommand}`);
            console.error("Run 'zap help spec' for available subcommands.");
            return 1;
        }
    }

    // Route shorthand commands
    if (command === 'propose') {
        const proposalText = args.slice(1).join(' ');
        return await handleSpecPropose(proposalText);
    }

    if (command === 'archive') {
        const specId = args[1];
        return await handleSpecArchive(specId);
    }

    // Route versions commands
    if (command === 'versions') {
        if (subcommand === 'reset') {
            return await handleVersionsReset();
        } else if (subcommand === 'push') {
            return await handleVersionsPush();
        } else if (!subcommand) {
            error('Error: versions command requires a subcommand');
            console.error("Run 'zap help versions' for more information.");
            return 1;
        } else {
            error(`Error: Unknown versions subcommand: ${subcommand}`);
            console.error("Run 'zap help versions' for available subcommands.");
            return 1;
        }
    }

    // Route help command
    if (command === 'help') {
        return await handleHelp(subcommand);
    }

    // Unknown command
    error(`Error: Unknown command: ${command}`);
    console.error("Run 'zap help' to see all available commands.");
    return 1;
}
