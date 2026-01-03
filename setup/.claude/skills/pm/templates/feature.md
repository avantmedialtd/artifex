# Feature Template

Work breakdown for implementing a general feature.

## Task Structure

When breaking down a feature epic, create these subtasks:

### 1. Requirements Analysis
- **Summary**: Analyze requirements for {feature}
- **Description**: Review specs, identify edge cases, clarify with stakeholders
- **Estimate**: 1-2h

### 2. Technical Design
- **Summary**: Design implementation approach for {feature}
- **Description**: Plan architecture, data models, API changes, UI components
- **Estimate**: 1-3h

### 3. Backend Implementation
- **Summary**: Implement backend for {feature}
- **Description**: Database changes, API endpoints, business logic
- **Estimate**: 2-8h (varies by complexity)

### 4. Frontend Implementation
- **Summary**: Implement frontend for {feature}
- **Description**: UI components, state management, API integration
- **Estimate**: 2-8h (varies by complexity)

### 5. Integration
- **Summary**: Integrate {feature} frontend and backend
- **Description**: Connect UI to API, handle loading/error states
- **Estimate**: 1-2h

### 6. Testing
- **Summary**: Test {feature}
- **Description**: Unit tests, integration tests, E2E tests
- **Estimate**: 2-4h

### 7. Documentation
- **Summary**: Document {feature}
- **Description**: Update user docs, API docs, or internal documentation
- **Estimate**: 1h

## Scaling for Complexity

**Small Feature** (1-2 days):
- Combine analysis + design
- Single implementation task
- Basic testing

**Medium Feature** (3-5 days):
- Separate analysis and design
- Split backend/frontend
- Comprehensive testing

**Large Feature** (1+ weeks):
- Detailed requirements analysis
- Technical design document
- Multiple implementation phases
- Phased testing (unit -> integration -> E2E)
- Documentation and training

## Example Jira Commands

```bash
# Create subtasks for PROJ-400 (the epic)
./scripts/jira/jira.ts create --project PROJ --type Sub-task --summary "Analyze requirements for email notifications" --parent PROJ-400

./scripts/jira/jira.ts create --project PROJ --type Sub-task --summary "Design email notification system" --parent PROJ-400

./scripts/jira/jira.ts create --project PROJ --type Sub-task --summary "Implement email notification backend" --parent PROJ-400

./scripts/jira/jira.ts create --project PROJ --type Sub-task --summary "Implement email notification UI" --parent PROJ-400

./scripts/jira/jira.ts create --project PROJ --type Sub-task --summary "Write tests for email notifications" --parent PROJ-400
```

## Definition of Done

Before marking the epic as done:
- [ ] All acceptance criteria met
- [ ] Code reviewed and approved
- [ ] Tests passing (unit, integration, E2E as appropriate)
- [ ] No known bugs or regressions
- [ ] Documentation updated
- [ ] Deployed to staging and verified
- [ ] Product owner sign-off (if applicable)
