# commit-work-command Specification

## Purpose
TBD - created by archiving change update-commit-work-archive. Update Purpose after archive.
## Requirements
### Requirement: Auto-Archive Before Commit

The `/commit-work` command SHALL archive the OpenSpec change if it has not already been archived before creating the commit, following the full archive workflow.

#### Scenario: Change exists and needs archiving

- **WHEN** the OpenSpec change directory exists at `openspec/changes/<id>/`
- **THEN** the command SHALL perform the full archive workflow:
  1. Run `openspec archive <id> --yes` to move the change and apply spec updates
  2. Review the command output to confirm specs were updated and change landed in `changes/archive/`
  3. Validate with `openspec validate --strict` and inspect with `openspec show <id>` if anything looks off
  4. Ensure everything meets the project's formatting rules (run `bun run format` if needed)
- **AND** proceed with the commit after archiving completes successfully

#### Scenario: Change already archived

- **WHEN** the OpenSpec change directory does not exist at `openspec/changes/<id>/`
- **AND** an archived version exists at `openspec/changes/archive/*-<id>/`
- **THEN** the command SHALL skip the archive step
- **AND** proceed directly to the commit

#### Scenario: No matching change found

- **WHEN** neither an active nor archived change exists for the given ID
- **THEN** the command SHALL still proceed with the commit
- **AND** use the provided title (or prompt for one if not provided)

