import { spawn } from 'node:child_process';
import { getAgentCommand } from '../utils/claude.ts';
import { stageAndCommit, stageDirectory } from '../utils/git.ts';
import { listOngoingChanges } from '../utils/openspec.ts';
import { error, info, success, warn } from '../utils/output.ts';
import { extractProposalTitle, getLatestChangeId } from '../utils/proposal.ts';

/**
 * Builds command arguments for the agent, conditionally adding Claude-specific flags.
 *
 * @param slashCommand - The OpenSpec slash command to execute
 * @returns Array of command arguments
 */
function buildAgentArgs(slashCommand: string): string[] {
    const agentCommand = getAgentCommand();

    if (agentCommand === 'claude') {
        return ['--permission-mode', 'acceptEdits', slashCommand];
    }

    if (agentCommand === 'copilot') {
        return ['--allow-all-tools', '-p', slashCommand];
    }

    return [slashCommand];
}

/**
 * Invoke Claude with the archive command for a specific spec-id.
 *
 * @param specId - The spec ID to archive
 * @returns Exit code (0 for success, 1 for error)
 */
function invokeArchive(specId: string): Promise<number> {
    // Extract the title from the proposal before archiving
    const specDir = `openspec/changes/${specId}`;
    const proposalPath = `${specDir}/proposal.md`;
    const title = extractProposalTitle(proposalPath);

    if (!title) {
        warn('Warning: Could not extract proposal title for auto-commit');
        return Promise.resolve(1);
    }

    const slashCommand = `/openspec:archive ${specId}`;
    const claudeArgs = buildAgentArgs(slashCommand);
    const claudeProcess = spawn(getAgentCommand(), claudeArgs, {
        stdio: 'inherit',
    });

    return new Promise(resolve => {
        claudeProcess.on('close', code => {
            // If Claude process failed, return the error code
            if (code !== 0) {
                resolve(code ?? 1);
                return;
            }

            const commitMessage = `Archive: ${title}`;
            stageDirectory(`openspec/specs`);
            stageDirectory(`openspec/changes/archive`);
            const result = stageAndCommit(specDir, commitMessage);

            if (!result.success) {
                warn(`Warning: Failed to auto-commit archive: ${result.error}`);
                warn('Archive completed but not committed. Please commit manually.');
                resolve(0);
                return;
            }

            success(`Archive committed: ${commitMessage}`);
            resolve(0);
        });

        claudeProcess.on('error', err => {
            error(`Error executing claude command: ${err.message}`);
            resolve(1);
        });
    });
}

/**
 * Handle the 'spec archive [spec-id]' command.
 * Archives a spec by invoking Claude Code with the openspec:archive command.
 * After successful archival, automatically commits the archived spec files.
 *
 * When spec-id is omitted:
 * - 0 changes: Show error message
 * - 1 change: Auto-select it
 * - Multiple changes: Show interactive selection menu
 *
 * @param specId - Optional spec ID to archive
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleSpecArchive(specId: string | undefined): Promise<number> {
    // If specId is provided, invoke directly
    if (specId) {
        return invokeArchive(specId);
    }

    // No specId provided - check how many ongoing changes exist
    const changes = listOngoingChanges();

    if (changes.length === 0) {
        error('No ongoing changes found');
        return 1;
    }

    if (changes.length === 1) {
        const selectedChange = changes[0];
        info(`Auto-selected change: ${selectedChange.id}`);
        return invokeArchive(selectedChange.id);
    }

    // Multiple changes - show interactive selection (uses dynamic import for .tsx)
    const { renderChangeSelect } = await import('../utils/change-select-render.tsx');
    const selectedId = await renderChangeSelect(changes, 'Select a change to archive:');

    if (!selectedId) {
        // User cancelled selection
        return 0;
    }

    return invokeArchive(selectedId);
}

/**
 * Invoke Claude with the apply command for a specific change-id.
 *
 * @param changeId - The change ID to apply
 * @returns Exit code (0 for success, 1 for error)
 */
function invokeApply(changeId: string): Promise<number> {
    const slashCommand = `/openspec:apply ${changeId}`;
    const claudeArgs = buildAgentArgs(slashCommand);
    const claudeProcess = spawn(getAgentCommand(), claudeArgs, {
        stdio: 'inherit',
    });

    return new Promise(resolve => {
        claudeProcess.on('close', code => {
            resolve(code ?? 1);
        });

        claudeProcess.on('error', err => {
            error(`Error executing claude command: ${err.message}`);
            resolve(1);
        });
    });
}

/**
 * Handle the 'spec apply [change-id]' command.
 * Applies an approved OpenSpec change by invoking Claude Code with the openspec:apply command.
 *
 * When change-id is omitted:
 * - 0 changes: Show error message
 * - 1 change: Auto-select it
 * - Multiple changes: Show interactive selection menu
 *
 * @param changeId - Optional change ID to apply
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleSpecApply(changeId: string | undefined): Promise<number> {
    // If changeId is provided, invoke directly
    if (changeId) {
        return invokeApply(changeId);
    }

    // No changeId provided - check how many ongoing changes exist
    const changes = listOngoingChanges();

    if (changes.length === 0) {
        error('No ongoing changes found');
        return 1;
    }

    if (changes.length === 1) {
        const selectedChange = changes[0];
        info(`Auto-selected change: ${selectedChange.id}`);
        return invokeApply(selectedChange.id);
    }

    // Multiple changes - show interactive selection (uses dynamic import for .tsx)
    const { renderChangeSelect } = await import('../utils/change-select-render.tsx');
    const selectedId = await renderChangeSelect(changes, 'Select a change to apply:');

    if (!selectedId) {
        // User cancelled selection
        return 0;
    }

    return invokeApply(selectedId);
}

/**
 * Handle the 'spec propose <text>' command.
 * Creates a new spec proposal by invoking Claude Code with the openspec:proposal command.
 * After successful proposal creation, automatically commits the proposal files.
 *
 * @param proposalText - The proposal text
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleSpecPropose(proposalText: string): Promise<number> {
    // Validate that proposalText is provided
    if (!proposalText || proposalText.trim() === '') {
        error('Error: spec propose requires proposal text');
        console.error('Usage: af spec propose <proposal-text>');
        return 1;
    }

    // Build and execute the claude command
    const claudeArgs = buildAgentArgs(`/openspec:proposal ${proposalText}`);
    const claudeProcess = spawn(getAgentCommand(), claudeArgs, {
        stdio: 'inherit', // Pipe stdout, stderr, and stdin to parent process
    });

    // Wait for the process to complete and return its status code
    return new Promise(resolve => {
        claudeProcess.on('close', code => {
            // If Claude process failed, return the error code
            if (code !== 0) {
                resolve(code ?? 1);
                return;
            }

            // Proposal created successfully, now auto-commit
            const changeId = getLatestChangeId();
            if (!changeId) {
                warn('Warning: Could not determine change ID for auto-commit');
                warn('Proposal created but not committed. Please commit manually.');
                resolve(0);
                return;
            }

            const proposalPath = `openspec/changes/${changeId}/proposal.md`;
            const title = extractProposalTitle(proposalPath);
            if (!title) {
                warn('Warning: Could not extract proposal title for auto-commit');
                warn('Proposal created but not committed. Please commit manually.');
                resolve(0);
                return;
            }

            const commitMessage = `Propose: ${title}`;
            const changeDir = `openspec/changes/${changeId}`;
            const result = stageAndCommit(changeDir, commitMessage);

            if (!result.success) {
                warn(`Warning: Failed to auto-commit proposal: ${result.error}`);
                warn('Proposal created but not committed. Please commit manually.');
                resolve(0);
                return;
            }

            success(`Proposal committed: ${commitMessage}`);
            resolve(0);
        });

        claudeProcess.on('error', err => {
            error(`Error executing claude command: ${err.message}`);
            resolve(1);
        });
    });
}
