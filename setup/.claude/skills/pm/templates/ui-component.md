# UI Component Template

Work breakdown for implementing a new React UI component or page.

## Task Structure

When breaking down a UI component epic, create these subtasks:

### 1. Design Review
- **Summary**: Review design for {component}
- **Description**: Analyze mockups/designs, identify edge cases, confirm responsive requirements
- **Estimate**: 30m-1h

### 2. Component Structure
- **Summary**: Create {component} component structure
- **Description**: Set up component files, props interface, basic layout
- **Estimate**: 1-2h

### 3. Styling
- **Summary**: Implement {component} styling
- **Description**: Apply design system styles, handle responsive breakpoints
- **Estimate**: 1-2h

### 4. State Management
- **Summary**: Add state management for {component}
- **Description**: Implement local state, connect to global state if needed
- **Estimate**: 1-2h

### 5. API Integration
- **Summary**: Connect {component} to API
- **Description**: Implement data fetching, loading states, error handling
- **Estimate**: 1-2h

### 6. User Interactions
- **Summary**: Implement {component} interactions
- **Description**: Add event handlers, form validation, user feedback
- **Estimate**: 1-2h

### 7. Accessibility
- **Summary**: Add accessibility to {component}
- **Description**: ARIA labels, keyboard navigation, screen reader support
- **Estimate**: 1h

### 8. Unit Tests
- **Summary**: Write tests for {component}
- **Description**: Test component rendering, interactions, edge cases
- **Estimate**: 1-2h

### 9. E2E Tests
- **Summary**: Add E2E test for {component}
- **Description**: Test user flow with Playwright
- **Estimate**: 1h

## Example Jira Commands

```bash
# Create subtasks for PROJ-200 (the epic)
af jira create --project PROJ --type Sub-task --summary "Create BookingCalendar component structure" --parent PROJ-200

af jira create --project PROJ --type Sub-task --summary "Implement BookingCalendar styling" --parent PROJ-200

af jira create --project PROJ --type Sub-task --summary "Connect BookingCalendar to booking API" --parent PROJ-200

af jira create --project PROJ --type Sub-task --summary "Write tests for BookingCalendar" --parent PROJ-200

af jira create --project PROJ --type Sub-task --summary "Add E2E test for BookingCalendar flow" --parent PROJ-200
```

## Checklist

Before marking the epic as done:
- [ ] Component matches design mockups
- [ ] Responsive on all target breakpoints
- [ ] Loading and error states implemented
- [ ] Keyboard accessible
- [ ] Unit tests passing
- [ ] E2E test covering main flow
- [ ] No console errors or warnings
