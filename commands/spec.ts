import { spawn } from 'node:child_process';
import { checkClaudeAvailable, getAgentCommand } from '../utils/claude.ts';
import { stageAndCommit } from '../utils/git.ts';
import { error, success, warn } from '../utils/output.ts';
import { extractProposalTitle, getLatestChangeId } from '../utils/proposal.ts';

/**
 * Handle the 'spec archive [spec-id]' command.
 * Archives a spec by invoking Claude Code with the openspec:archive command.
 * After successful archival, automatically commits the archived spec files.
 *
 * @param specId - Optional spec ID to archive (Claude prompts if omitted)
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleSpecArchive(specId: string | undefined): Promise<number> {
    // Check if Claude Code is available
    const isClaudeAvailable = await checkClaudeAvailable();
    if (!isClaudeAvailable) {
        error('Error: Claude Code CLI is not installed or not in PATH');
        console.error('Please install Claude Code from: https://claude.com/claude-code');
        return 1;
    }

    // Build and execute the claude command
    // If specId is provided, include it; otherwise, let Claude prompt interactively
    const slashCommand = specId ? `/openspec:archive ${specId}` : '/openspec:archive';
    const claudeArgs = ['--permission-mode', 'acceptEdits', slashCommand];
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

            // Archive completed successfully, now auto-commit
            // If spec-id was not provided, we need to determine it from the newly archived spec
            // The latest spec in openspec/specs/ will be the one just archived
            let actualSpecId = specId;
            if (!actualSpecId) {
                // TODO: Implement logic to find the latest archived spec
                // For now, skip auto-commit when spec-id is not provided
                warn('Warning: Auto-commit skipped when spec-id is not provided');
                warn('Archive completed but not committed. Please commit manually.');
                resolve(0);
                return;
            }

            // After archive, the spec is located at openspec/specs/<spec-id>/
            const specDir = `openspec/specs/${actualSpecId}`;
            const proposalPath = `${specDir}/proposal.md`;

            const title = extractProposalTitle(proposalPath);
            if (!title) {
                warn('Warning: Could not extract proposal title for auto-commit');
                warn('Archive completed but not committed. Please commit manually.');
                resolve(0);
                return;
            }

            const commitMessage = `Archive: ${title}`;
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
 * Handle the 'spec apply [change-id]' command.
 * Applies an approved OpenSpec change by invoking Claude Code with the openspec:apply command.
 *
 * @param changeId - Optional change ID to apply (Claude prompts if omitted)
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleSpecApply(changeId: string | undefined): Promise<number> {
    // Check if Claude Code is available
    const isClaudeAvailable = await checkClaudeAvailable();
    if (!isClaudeAvailable) {
        error('Error: Claude Code CLI is not installed or not in PATH');
        console.error('Please install Claude Code from: https://claude.com/claude-code');
        return 1;
    }

    // Build and execute the claude command
    // If changeId is provided, include it; otherwise, let Claude prompt interactively
    const slashCommand = changeId ? `/openspec:apply ${changeId}` : '/openspec:apply';
    const claudeArgs = ['--permission-mode', 'acceptEdits', slashCommand];
    const claudeProcess = spawn(getAgentCommand(), claudeArgs, {
        stdio: 'inherit', // Pipe stdout, stderr, and stdin to parent process
    });

    // Wait for the process to complete and return its status code
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
        console.error('Usage: zap spec propose <proposal-text>');
        return 1;
    }

    // Check if Claude Code is available
    const isClaudeAvailable = await checkClaudeAvailable();
    if (!isClaudeAvailable) {
        error('Error: Claude Code CLI is not installed or not in PATH');
        console.error('Please install Claude Code from: https://claude.com/claude-code');
        return 1;
    }

    // Build and execute the claude command
    const claudeArgs = ['--permission-mode', 'acceptEdits', `/openspec:proposal ${proposalText}`];
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
