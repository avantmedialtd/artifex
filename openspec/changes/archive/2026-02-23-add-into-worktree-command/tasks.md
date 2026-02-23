## 1. Command File

- [x] 1.1 Create `setup/.claude/commands/into-worktree.md` with frontmatter (name, description, category, tags) and prompt instructions covering: change-id resolution (explicit, inferred, or ask), capturing the current repo path, calling `EnterWorktree`, and env file copying via Bash
- [x] 1.2 Regenerate the setup manifest with `bun run generate:manifest` to include the new command file

## 2. Verification

- [x] 2.1 Run `af setup --list` and verify `into-worktree.md` appears in the output
- [x] 2.2 Run format, lint, and spell checks to ensure no violations
