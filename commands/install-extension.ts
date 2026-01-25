/**
 * Install extension command handler.
 * Installs the bundled VSCode extension from the embedded VSIX file.
 */

import { spawn } from 'node:child_process';
import { copyFileSync, unlinkSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { EXTENSION_FILE, isCompiled } from '../generated/setup-manifest.ts';
import { success, error, info } from '../utils/output.ts';

/**
 * Check if VSCode CLI is available.
 */
async function isCodeCliAvailable(): Promise<boolean> {
    return new Promise(resolve => {
        const child = spawn('code', ['--version'], { stdio: 'pipe' });
        child.on('error', () => resolve(false));
        child.on('close', code => resolve(code === 0));
    });
}

/**
 * Install extension using VSCode CLI.
 */
async function installExtension(vsixPath: string): Promise<{ success: boolean; output: string }> {
    return new Promise(resolve => {
        const child = spawn('code', ['--install-extension', vsixPath], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', data => {
            stdout += data.toString();
        });

        child.stderr?.on('data', data => {
            stderr += data.toString();
        });

        child.on('error', err => {
            resolve({ success: false, output: err.message });
        });

        child.on('close', code => {
            if (code === 0) {
                resolve({ success: true, output: stdout });
            } else {
                resolve({ success: false, output: stderr || stdout });
            }
        });
    });
}

/**
 * Handle the 'install-extension' command.
 * Installs the bundled VSCode extension.
 *
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleInstallExtension(): Promise<number> {
    // Check if extension file is available
    if (!EXTENSION_FILE) {
        error('Error: No extension file bundled');
        console.error('The VSCode extension file is not available.');
        return 1;
    }

    // Check if VSCode CLI is available
    info('Checking for VSCode CLI...');
    const codeAvailable = await isCodeCliAvailable();

    if (!codeAvailable) {
        error('Error: VSCode CLI not found');
        console.error('The "code" command is not available. Please ensure VSCode is installed');
        console.error('and the "code" command is in your PATH.');
        console.error('');
        console.error('To add the "code" command to PATH:');
        console.error('  1. Open VSCode');
        console.error('  2. Press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows/Linux)');
        console.error('  3. Type "Shell Command: Install \'code\' command in PATH"');
        return 1;
    }

    // Create temp directory and copy VSIX file
    info(`Installing ${EXTENSION_FILE.name}...`);
    const tempDir = mkdtempSync(join(tmpdir(), 'artifex-extension-'));
    const tempVsixPath = join(tempDir, EXTENSION_FILE.name);

    try {
        // Copy embedded file to temp location
        if (isCompiled()) {
            // In compiled mode, use Bun.file() to read from $bunfs virtual filesystem
            const content = await Bun.file(EXTENSION_FILE.embeddedPath).bytes();
            writeFileSync(tempVsixPath, content);
        } else {
            // In development mode, copy from source directory
            const sourcePath = join(
                dirname(import.meta.dirname),
                'vscode-extension',
                EXTENSION_FILE.name,
            );
            copyFileSync(sourcePath, tempVsixPath);
        }

        // Install the extension
        const result = await installExtension(tempVsixPath);

        if (result.success) {
            success('Extension installed successfully!');
            if (result.output.trim()) {
                console.log(result.output.trim());
            }
            return 0;
        } else {
            error('Error: Extension installation failed');
            if (result.output.trim()) {
                console.error(result.output.trim());
            }
            return 1;
        }
    } finally {
        // Clean up temp file
        try {
            unlinkSync(tempVsixPath);
        } catch {
            // Ignore cleanup errors
        }
    }
}
