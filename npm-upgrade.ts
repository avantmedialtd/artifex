import { spawn } from 'child_process';

interface OutdatedPackage {
    current: string;
    wanted: string;
    latest: string;
    dependent: string;
    location: string;
}

interface OutdatedPackages {
    [packageName: string]: OutdatedPackage;
}

interface UpgradeResult {
    package: string;
    success: boolean;
    error?: string;
}

/**
 * Execute npm outdated and return list of packages that need updating
 */
export async function getOutdatedPackages(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const npmProcess = spawn('npm', ['outdated', '--json'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
        });

        let stdout = '';
        let stderr = '';

        npmProcess.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        npmProcess.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        npmProcess.on('close', (code: number | null) => {
            // npm outdated returns exit code 1 when there are outdated packages
            // and 0 when all packages are up to date
            if (code !== 0 && code !== 1) {
                reject(new Error(`npm outdated failed with code ${code}: ${stderr}`));
                return;
            }

            // If stdout is empty, no packages are outdated
            if (!stdout.trim()) {
                resolve([]);
                return;
            }

            try {
                const outdated: OutdatedPackages = JSON.parse(stdout);
                const packageNames = Object.keys(outdated);
                resolve(packageNames);
            } catch (error) {
                reject(new Error(`Failed to parse npm outdated output: ${error}`));
            }
        });

        npmProcess.on('error', (error: Error) => {
            reject(new Error(`Failed to execute npm outdated: ${error.message}`));
        });
    });
}

/**
 * Upgrade a single package to its latest version
 */
export async function upgradePackage(packageName: string): Promise<UpgradeResult> {
    return new Promise(resolve => {
        console.log(`\nUpgrading ${packageName}...`);

        const npmProcess = spawn('npm', ['install', `${packageName}@latest`], {
            stdio: ['ignore', 'inherit', 'inherit'],
            shell: true,
        });

        npmProcess.on('close', (code: number | null) => {
            if (code === 0) {
                resolve({ package: packageName, success: true });
            } else {
                resolve({
                    package: packageName,
                    success: false,
                    error: `npm install failed with exit code ${code}`,
                });
            }
        });

        npmProcess.on('error', (error: Error) => {
            resolve({
                package: packageName,
                success: false,
                error: error.message,
            });
        });
    });
}

/**
 * Upgrade all outdated packages sequentially
 */
export async function upgradeAllPackages(packages: string[]): Promise<UpgradeResult[]> {
    const results: UpgradeResult[] = [];

    for (const packageName of packages) {
        const result = await upgradePackage(packageName);
        results.push(result);
    }

    return results;
}
