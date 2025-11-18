# Proposal: VSCode Extension Copy Change ID Button

## Overview

Add a button or context menu action to the VSCode extension that allows users to quickly copy a change ID to the clipboard. This complements the existing "copy title" functionality and makes it easier to reference change IDs in commands, documentation, or discussions.

## Problem

Currently, users can click on a change to copy its title, but there's no quick way to copy the change ID itself (e.g., "add-feature", "fix-bug"). Change IDs are frequently needed for:

- Running CLI commands like `zap spec archive <change-id>` or `zap spec apply <change-id>`
- Referencing changes in commit messages or documentation
- Sharing change identifiers with team members

Users must manually select and copy the change ID from the tree view label, which is error-prone since the label includes additional text like task counts.

## Solution

Add a context menu command that copies the change ID to the clipboard when the user right-clicks on a change item in the tree view. This provides a quick, error-free way to get the change ID without parsing the label text.

## Scope

**In Scope:**
- Add "Copy Change ID" command to the extension
- Register context menu item for change tree items
- Copy plain change ID string to clipboard
- Show confirmation message after copying

**Out of Scope:**
- Modifying the existing "Copy Title" functionality
- Adding copy functionality for sections or tasks
- Clipboard history or multiple clipboard formats
- Keyboard shortcuts for copying

## Success Criteria

- User can right-click on any change in the tree view and see "Copy Change ID" option
- Selecting the option copies only the change ID (e.g., "add-feature") to clipboard
- User sees a confirmation message after successful copy
- Existing copy title functionality remains unchanged

## Related Changes

None - this is a standalone enhancement to the VSCode extension.
