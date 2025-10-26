import { getOutdatedPackages, upgradeAllPackages } from './npm-upgrade.ts';

// Parse command-line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('zap CLI ready');
  process.exit(0);
}

const [command, subcommand] = args;

if (command === 'npm') {
  if (subcommand === 'upgrade') {
    await runNpmUpgrade();
  } else if (!subcommand) {
    console.error('Error: npm command requires a subcommand (e.g., upgrade)');
    process.exit(1);
  } else {
    console.error(`Error: Unknown npm subcommand: ${subcommand}`);
    process.exit(1);
  }
} else {
  console.error(`Error: Unknown command: ${command}`);
  process.exit(1);
}

async function runNpmUpgrade() {
  try {
    console.log('Checking for outdated packages...');

    const outdatedPackages = await getOutdatedPackages();

    if (outdatedPackages.length === 0) {
      console.log('All packages are up to date!');
      process.exit(0);
    }

    console.log(`\nFound ${outdatedPackages.length} package(s) to upgrade:`);
    outdatedPackages.forEach(pkg => console.log(`  - ${pkg}`));
    console.log('');

    const results = await upgradeAllPackages(outdatedPackages);

    // Display summary
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log('\n' + '='.repeat(50));
    console.log('Upgrade Summary');
    console.log('='.repeat(50));
    console.log(`Successfully upgraded: ${successful.length} package(s)`);

    if (successful.length > 0) {
      successful.forEach(r => console.log(`  ✓ ${r.package}`));
    }

    if (failed.length > 0) {
      console.log(`\nFailed to upgrade: ${failed.length} package(s)`);
      failed.forEach(r => console.log(`  ✗ ${r.package}: ${r.error}`));
      process.exit(1);
    }

    console.log('\nAll packages upgraded successfully!');
    process.exit(0);

  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}
