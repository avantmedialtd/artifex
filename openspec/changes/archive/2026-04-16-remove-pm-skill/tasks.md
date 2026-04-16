## 1. Delete bundled files

- [x] 1.1 Delete `setup/.claude/skills/pm/SKILL.md`
- [x] 1.2 Delete `setup/.claude/skills/pm/templates/api-endpoint.md`
- [x] 1.3 Delete `setup/.claude/skills/pm/templates/bug-fix.md`
- [x] 1.4 Delete `setup/.claude/skills/pm/templates/feature.md`
- [x] 1.5 Delete `setup/.claude/skills/pm/templates/ui-component.md`
- [x] 1.6 Delete the now-empty `setup/.claude/skills/pm/templates/` directory
- [x] 1.7 Delete the now-empty `setup/.claude/skills/pm/` directory
- [x] 1.8 Delete the now-empty `setup/.claude/skills/` directory

## 2. Regenerate setup manifest

- [x] 2.1 Run `bun run generate:manifest` and confirm `generated/setup-manifest.ts` no longer references any `skills/pm/` paths
- [x] 2.2 Run `bun run compile` to confirm the binary builds cleanly with the updated manifest

## 3. Update setup-command spec

- [x] 3.1 Rewrite the **Nested directory copying** scenario in `openspec/specs/setup-command/spec.md` (under **Directory Structure Preservation**) to use a hypothetical nested path instead of `setup/.claude/skills/pm/SKILL.md`

## 4. Verify

- [x] 4.1 Run `bun run format:check` and `bun run lint`
- [x] 4.2 Run `bun run spell:check`
- [x] 4.3 Run `bun run test` (Vitest) and confirm setup-command tests still pass
- [x] 4.4 Run `openspec validate remove-pm-skill` and confirm the change validates
