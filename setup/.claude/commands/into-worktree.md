---
name: Into Worktree
description: Create a git worktree for an OpenSpec change and enter it.
category: Workflow
tags: [git, worktree, openspec, workflow]
---

**Usage**

```
/into-worktree [change-id]
```

Examples:
- `/into-worktree add-widget` — Creates and enters a worktree named `add-widget`
- `/into-worktree` — Infers the change-id from conversation context

**Steps**

1. **Resolve the change-id:**
   - If an argument is provided, use it as the change-id
   - If no argument is provided, infer the change-id from the current conversation context (e.g., a change discussed during `/opsx:explore` or an active OpenSpec change)
   - If no change-id can be inferred, ask the user to provide one

2. **Check if the worktree already exists:**
   ```bash
   test -d .claude/worktrees/<change-id> && echo "exists" || echo "not found"
   ```
   If it exists, inform the user and suggest starting a new Claude session from that directory instead:
   > "Worktree already exists at `.claude/worktrees/<change-id>/`. Start a new Claude session from that directory to continue working."

   **STOP** if the worktree already exists.

3. **Capture the current repository path** before entering the worktree:
   ```bash
   pwd
   ```
   Save this as `ORIGINAL_REPO` for use in step 5.

4. **Create and enter the worktree** using the `EnterWorktree` tool:
   - Call `EnterWorktree` with `name` set to the change-id

5. **Copy environment files** from the original repository into the worktree:
   ```bash
   # Copy .env if it exists
   test -f <ORIGINAL_REPO>/.env && cp <ORIGINAL_REPO>/.env .env

   # Copy .env.local if it exists
   test -f <ORIGINAL_REPO>/.env.local && cp <ORIGINAL_REPO>/.env.local .env.local

   # Copy git-excluded files (preserving directory structure)
   cd <ORIGINAL_REPO> && git ls-files --others --ignored --exclude-from=.git/info/exclude | while read f; do
     mkdir -p "<WORKTREE_PATH>/$(dirname "$f")"
     cp "$f" "<WORKTREE_PATH>/$f"
   done
   ```
   Replace `<ORIGINAL_REPO>` with the path captured in step 3 and `<WORKTREE_PATH>` with the current working directory after entering the worktree.

   Do not report an error if no files are found to copy.

6. **Confirm completion:**
   > "Entered worktree `<change-id>` at `.claude/worktrees/<change-id>/`. You can now continue with `/opsx:new`, `/opsx:ff`, or any other workflow command."
