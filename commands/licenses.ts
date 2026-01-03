import { header, listItem, section } from '../utils/output.ts';

/**
 * Third-party dependencies bundled in the compiled binary.
 * These are runtime dependencies from package.json.
 */
const THIRD_PARTY_LICENSES: Array<{ name: string; license: string; url: string }> = [
    { name: 'ink', license: 'MIT', url: 'https://github.com/vadimdemedes/ink' },
    { name: 'react', license: 'MIT', url: 'https://github.com/facebook/react' },
    { name: 'react-devtools-core', license: 'MIT', url: 'https://github.com/facebook/react' },
];

/**
 * Handle the 'licenses' command.
 * Displays copyright and license information.
 *
 * @returns Exit code (always 0)
 */
export async function handleLicenses(): Promise<number> {
    header('Artifex');
    console.log('(c) Avant Media LTD. Proprietary and confidential.\n');
    console.log('This software is the exclusive property of Avant Media LTD.');
    console.log('Unauthorized copying, modification, or distribution is prohibited.');

    section('Third-Party Licenses');
    console.log('This software includes the following open source components:\n');
    for (const dep of THIRD_PARTY_LICENSES) {
        listItem(`${dep.name} (${dep.license}) - ${dep.url}`);
    }

    return 0;
}
