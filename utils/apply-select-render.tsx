import React from 'react';
import { ApplyChangeSelect } from '../components/apply-select.tsx';
import { render } from './ink-render.tsx';
import type { OngoingChange } from './openspec.ts';

/**
 * Render the interactive change selection UI and return the selected change ID.
 *
 * @param changes - Array of ongoing changes to choose from
 * @returns Promise that resolves to selected change ID, or null if cancelled
 */
export function renderApplyChangeSelect(changes: OngoingChange[]): Promise<string | null> {
    return new Promise(resolve => {
        let cancelled = false;

        const { unmount } = render(
            <ApplyChangeSelect
                changes={changes}
                onSelect={selectedId => {
                    unmount();
                    resolve(selectedId);
                }}
                onCancel={() => {
                    cancelled = true;
                    unmount();
                    resolve(null);
                }}
            />,
        );

        // Handle case where component is unmounted without selection
        process.on('SIGINT', () => {
            if (!cancelled) {
                unmount();
                resolve(null);
            }
        });
    });
}
