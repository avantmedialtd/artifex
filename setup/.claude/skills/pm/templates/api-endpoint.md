# API Endpoint Template

Work breakdown for implementing a new REST or GraphQL API endpoint.

## Task Structure

When breaking down an API endpoint epic, create these subtasks:

### 1. Design & Planning
- **Summary**: Design {endpoint} API contract
- **Description**: Define request/response schemas, error codes, and edge cases
- **Estimate**: 1-2h

### 2. Database/Entity Changes (if needed)
- **Summary**: Add database entities for {endpoint}
- **Description**: Create or modify TypeORM entities, generate migration
- **Estimate**: 1-2h

### 3. Controller Implementation
- **Summary**: Implement {endpoint} controller
- **Description**: Create endpoint with request validation, business logic, response formatting
- **Estimate**: 2-4h

### 4. Input Validation
- **Summary**: Add validation for {endpoint} inputs
- **Description**: Implement request validation with proper error messages
- **Estimate**: 1h

### 5. Error Handling
- **Summary**: Add error handling for {endpoint}
- **Description**: Handle edge cases, return appropriate error codes
- **Estimate**: 1h

### 6. Unit Tests
- **Summary**: Write unit tests for {endpoint}
- **Description**: Test controller logic, validation, error cases
- **Estimate**: 2-3h

### 7. Integration Tests (optional)
- **Summary**: Write integration tests for {endpoint}
- **Description**: Test full request/response cycle with database
- **Estimate**: 1-2h

### 8. Documentation (optional)
- **Summary**: Document {endpoint} API
- **Description**: Add OpenAPI/Swagger docs or update API documentation
- **Estimate**: 30m

## Example Jira Commands

```bash
# Create subtasks for PROJ-100 (the epic)
af jira create --project PROJ --type Sub-task --summary "Design user preferences API contract" --parent PROJ-100

af jira create --project PROJ --type Sub-task --summary "Implement user preferences controller" --parent PROJ-100

af jira create --project PROJ --type Sub-task --summary "Add validation for user preferences inputs" --parent PROJ-100

af jira create --project PROJ --type Sub-task --summary "Write unit tests for user preferences endpoint" --parent PROJ-100
```

## Checklist

Before marking the epic as done:
- [ ] Endpoint accessible and returns expected responses
- [ ] Input validation working with clear error messages
- [ ] Error cases handled gracefully
- [ ] Unit tests passing
- [ ] No security vulnerabilities (auth, injection, etc.)
