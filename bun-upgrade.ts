import { spawn } from 'child_process';

export interface UpgradeResult {
    package: string;
    success: boolean;
    error?: string;
}

/**
 * Parse bun outdated text output to extract package names.
 * Bun outputs a table format like:
 * ┌─────────┬─────────┬────────┬────────┐
 * │ Package │ Current │ Update │ Latest │
 * ├─────────┼─────────┼────────┼────────┤
 * │ lodash  │ 4.17.0  │ 4.17.21│ 4.17.21│
 * └─────────┴─────────┴────────┴────────┘
 */
export function parseBunOutdatedOutput(output: string): string[] {
    const lines = output.split('\n');
    const packages: string[] = [];

    for (const line of lines) {
        // Skip header row, separator rows, and empty lines
        if (!line.trim()) continue;
        if (line.includes('Package') && line.includes('Current')) continue;
        if (/^[┌├└─┬┼┴┐│┘]+$/.test(line.replace(/\s/g, ''))) continue;

        // Parse table data rows that start with │
        if (line.startsWith('│')) {
            const cells = line
                .split('│')
                .map(cell => cell.trim())
                .filter(cell => cell.length > 0);

            // First cell is the package name
            if (cells.length > 0 && cells[0] && !cells[0].includes('Package')) {
                packages.push(cells[0]);
            }
        }
    }

    return packages;
}

/**
 * Execute bun outdated and return list of packages that need updating
 */
export async function getBunOutdatedPackages(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const bunProcess = spawn('bun', ['outdated'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
        });

        let stdout = '';
        let stderr = '';

        bunProcess.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        bunProcess.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        bunProcess.on('close', (code: number | null) => {
            // bun outdated returns 0 for success (regardless of whether packages are outdated)
            if (code !== 0) {
                reject(new Error(`bun outdated failed with code ${code}: ${stderr}`));
                return;
            }

            // Parse the table output
            const packages = parseBunOutdatedOutput(stdout);
            resolve(packages);
        });

        bunProcess.on('error', (error: Error) => {
            reject(new Error(`Failed to execute bun outdated: ${error.message}`));
        });
    });
}

/**
 * Upgrade a single package to its latest version using bun
 */
export async function bunUpgradePackage(packageName: string): Promise<UpgradeResult> {
    return new Promise(resolve => {
        console.log(`\nUpgrading ${packageName}...`);

        const bunProcess = spawn('bun', ['add', `${packageName}@latest`], {
            stdio: ['ignore', 'inherit', 'inherit'],
            shell: true,
        });

        bunProcess.on('close', (code: number | null) => {
            if (code === 0) {
                resolve({ package: packageName, success: true });
            } else {
                resolve({
                    package: packageName,
                    success: false,
                    error: `bun add failed with exit code ${code}`,
                });
            }
        });

        bunProcess.on('error', (error: Error) => {
            resolve({
                package: packageName,
                success: false,
                error: error.message,
            });
        });
    });
}

/**
 * Upgrade all outdated packages sequentially using bun
 */
export async function bunUpgradeAllPackages(packages: string[]): Promise<UpgradeResult[]> {
    const results: UpgradeResult[] = [];

    for (const packageName of packages) {
        const result = await bunUpgradePackage(packageName);
        results.push(result);
    }

    return results;
}
