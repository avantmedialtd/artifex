import { error, info } from '../utils/output.ts';
import { getActiveChanges } from '../utils/proposal.ts';

/**
 * Handle the 'changes' command.
 * Lists all OpenSpec changes with their titles and task progress.
 *
 * @param hasArgs - Whether any arguments were provided to the command
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleChanges(hasArgs: boolean): Promise<number> {
    // Reject if arguments were provided
    if (hasArgs) {
        error('Error: changes command does not accept arguments');
        console.error('Usage: zap changes');
        return 1;
    }

    const changes = getActiveChanges();

    if (changes.length === 0) {
        info('No active changes');
        return 0;
    }

    console.log('Changes:');

    for (const change of changes) {
        const displayName = change.title ? `${change.title} (${change.id})` : change.id;
        const taskProgress = `${change.completedTasks}/${change.totalTasks} tasks`;
        console.log(`  ${displayName}     ${taskProgress}`);
    }

    return 0;
}
