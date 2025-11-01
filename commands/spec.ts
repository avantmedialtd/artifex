import { spawn } from 'node:child_process';
import { checkClaudeAvailable, getAgentCommand } from '../utils/claude.ts';
import { stageAndCommit } from '../utils/git.ts';
import { error, success, warn } from '../utils/output.ts';
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

    let actualSpecId = specId;

    // If specId is not provided, get the first one from openspec list --changes
    if (!actualSpecId) {
        const { execSync } = await import('node:child_process');
        try {
            const output = execSync('openspec list --changes', { encoding: 'utf-8' });
            // Parse the output to extract the first spec ID
            // Expected format:
            // Changes:
            //   spec-id-1     ✓ Complete
            //   spec-id-2     ⚠ In Progress
            const lines = output.split('\n').filter(line => line.trim());

            // Skip the "Changes:" header and find the first spec line
            for (const line of lines) {
                const trimmed = line.trim();
                // Skip the header line
                if (trimmed === 'Changes:' || trimmed === '') continue;

                // Extract the spec ID from lines like "  spec-id-name     ✓ Complete"
                // The spec ID is the first word after trimming
                const match = trimmed.match(/^(\S+)/);
                if (match) {
                    actualSpecId = match[1];
                    console.log(`Auto-selected spec ID: ${actualSpecId}`);
                    break;
                }
            }

            if (!actualSpecId) {
                console.log('No changes found to archive');
            }
        } catch (_err) {
            console.error('Failed to retrieve spec ID from openspec list --changes');
        }
    }

    // Build and execute the claude command
    // If actualSpecId is available, include it; otherwise, let Claude prompt interactively
    const slashCommand = actualSpecId ? `/openspec:archive ${actualSpecId}` : '/openspec:archive';
    const claudeArgs = buildAgentArgs(slashCommand);
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

            if (!actualSpecId) {
                // TODO: Implement logic to find the latest archived spec
                // For now, skip auto-commit when spec-id is not provided
                warn('Warning: Auto-commit skipped when spec-id is not provided');
                warn('Archive completed but not committed. Please commit manually.');
                resolve(0);
                return;
            }

            // Extract the title from the archived proposal
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
    const claudeArgs = buildAgentArgs(slashCommand);
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
