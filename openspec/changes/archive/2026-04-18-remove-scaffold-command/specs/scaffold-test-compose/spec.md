## REMOVED Requirements

### Requirement: Generate test compose file

**Reason**: The `af scaffold test-compose` command is being removed. Project-specific template generation has moved to a skill in the consumer repository, which is now the sole source of truth for the `docker-compose.test.yml` template.

**Migration**: Use the replacement skill from the consumer repository instead of `af scaffold test-compose`. There is no in-CLI fallback.

### Requirement: Valid compose file structure

**Reason**: The command that produced this file is being removed; this requirement no longer has a subject in `af`. Structural validity of the template is now the responsibility of the replacement skill.

**Migration**: The replacement skill owns the structure of the generated `docker-compose.test.yml`. Any future structural changes should be made there.

### Requirement: Scaffold command structure

**Reason**: The `scaffold` parent command is being removed entirely. No other subcommands exist under it, so there is no reason to keep the parent command stub.

**Migration**: Running `af scaffold ...` will surface the router's generic "unknown command" error. Users should invoke the replacement skill directly instead.

### Requirement: Help documentation

**Reason**: The command is being removed from the help system alongside the code, so help documentation for it is also removed.

**Migration**: `af help scaffold` will no longer be recognized. Users should consult the replacement skill's own documentation.
