---
name: Commit Work
description: Commit all changes with the OpenSpec proposal title and ID as a trailer.
category: Workflow
tags: [git, openspec, workflow]
---

**Usage**

```
/commit-work [openspec-id] [title]
```

Examples:
- `/commit-work` — Uses the ID and title from context
- `/commit-work add-user-auth "Add User Authentication"` — Uses provided arguments

**Steps**

1. **Determine OpenSpec ID and title:**
   - If arguments are provided, use them
   - If you are currently working on an OpenSpec, use that ID and title
   - Otherwise:
     1. Run `openspec list` to find active changes
     2. If exactly one active change exists, use that ID
     3. If multiple changes exist, ask the user which one to use
     4. If no changes exist, ask the user for the ID and title
     5. Extract the title from the first heading in `openspec/changes/<id>/proposal.md`

2. **Archive the OpenSpec change (if not already archived):**
   - Check if `openspec/changes/<id>/` directory exists
   - If it exists, perform the full archive workflow:
     1. Run `openspec archive <id> --yes` to move the change and apply spec updates
     2. Review the output to confirm specs were updated and the change landed in `changes/archive/`
     3. Validate with `openspec validate --strict` and inspect with `openspec show <id>` if anything looks off
     4. Ensure everything meets the project's formatting rules (run `bun run format` if needed)
   - If the directory does not exist (already archived), skip this step

3. Run the following command to stage all changes and create a commit:
   ```bash
   af commit save "<title>" OpenSpec-Id=<openspec-id>
   ```

**Reference**

- Run `af help commit` for commit subcommand options
