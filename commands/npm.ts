import { getOutdatedPackages, upgradeAllPackages } from '../npm-upgrade.ts';
import { info, success, error, header, listItem } from '../utils/output.ts';

/**
 * Handle the 'npm upgrade' command.
 * Checks for outdated packages and upgrades them all.
 *
 * @returns Exit code (0 for success, 1 for error)
 */
export async function handleNpmUpgrade(): Promise<number> {
    try {
        info('Checking for outdated packages...');

        const outdatedPackages = await getOutdatedPackages();

        if (outdatedPackages.length === 0) {
            success('All packages are up to date!');
            return 0;
        }

        console.log(`\nFound ${outdatedPackages.length} package(s) to upgrade:`);
        outdatedPackages.forEach(pkg => listItem(pkg));
        console.log('');

        const results = await upgradeAllPackages(outdatedPackages);

        // Display summary
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        header('Upgrade Summary');
        console.log('='.repeat(50));
        console.log(`Successfully upgraded: ${successful.length} package(s)`);

        if (successful.length > 0) {
            successful.forEach(r => listItem(r.package, '✓'));
        }

        if (failed.length > 0) {
            console.log(`\nFailed to upgrade: ${failed.length} package(s)`);
            failed.forEach(r => listItem(`${r.package}: ${r.error}`, '✗'));
            return 1;
        }

        success('\nAll packages upgraded successfully!');
        return 0;
    } catch (err) {
        if (err instanceof Error) {
            error(`Error: ${err.message}`);
        } else {
            error('An unexpected error occurred');
        }
        return 1;
    }
}
