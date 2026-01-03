## 1. Update Jira Skill Documentation

- [x] 1.1 Update `setup/.claude/skills/jira/SKILL.md` - replace all `./scripts/jira/jira.ts` with `af jira`
- [x] 1.2 Update setup instructions to reference project `.env` file instead of `scripts/jira/.env`

## 2. Update PM Skill Documentation

- [x] 2.1 Update `setup/.claude/skills/pm/SKILL.md` - replace all jira command references
- [x] 2.2 Update `setup/.claude/skills/pm/templates/feature.md`
- [x] 2.3 Update `setup/.claude/skills/pm/templates/api-endpoint.md`
- [x] 2.4 Update `setup/.claude/skills/pm/templates/ui-component.md`
- [x] 2.5 Update `setup/.claude/skills/pm/templates/bug-fix.md`

## 3. Update Command Documentation

- [x] 3.1 Update `setup/.claude/commands/start-work.md`
- [x] 3.2 Update `setup/.claude/commands/complete-work.md`

## 4. Validation

- [x] 4.1 Verify no remaining references to `scripts/jira/jira.ts`
- [x] 4.2 Test that `af jira --help` works correctly
