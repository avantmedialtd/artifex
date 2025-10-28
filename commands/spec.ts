import { spawn } from 'node:child_process';
import { checkClaudeAvailable } from '../utils/claude.ts';
import { error } from '../utils/output.ts';

/**
 * Handle the 'spec archive <id>' command.
 * Archives a spec by invoking Claude Code with the openspec:archive command.
 *
 * @param specId - The spec ID to archive
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleSpecArchive(specId: string | undefined): Promise<number> {
    // Validate that specId is provided
    if (!specId) {
        error('Error: spec archive requires a spec-id argument');
        console.error('Usage: zap spec archive <spec-id>');
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
    const claudeArgs = ['-p', '--permission-mode', 'acceptEdits', `/openspec:archive ${specId}`];
    const claudeProcess = spawn('claude', claudeArgs, {
        stdio: 'inherit', // Pipe stdout, stderr, and stdin to parent process
    });

    // Wait for the process to complete and return its status code
    return new Promise((resolve) => {
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
    const claudeProcess = spawn('claude', claudeArgs, {
        stdio: 'inherit', // Pipe stdout, stderr, and stdin to parent process
    });

    // Wait for the process to complete and return its status code
    return new Promise((resolve) => {
        claudeProcess.on('close', code => {
            resolve(code ?? 1);
        });

        claudeProcess.on('error', err => {
            error(`Error executing claude command: ${err.message}`);
            resolve(1);
        });
    });
}
