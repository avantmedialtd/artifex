## ADDED Requirements

### Requirement: Plain-text request helper

The shared HTTP layer SHALL provide a `requestText()` function for Atlassian API endpoints that return non-JSON content (e.g. pipeline logs, pull request diffs).

#### Scenario: Returns body as string

- **GIVEN** an authenticated Atlassian endpoint that returns `text/plain`
- **WHEN** `requestText(url)` is called
- **THEN** the response body is returned as a string

#### Scenario: Authentication header is shared

- **WHEN** `requestText(url)` is called
- **THEN** the same Basic auth header used by `request<T>()` is sent

#### Scenario: Non-2xx response throws

- **GIVEN** an endpoint that responds with a 4xx or 5xx status
- **WHEN** `requestText(url)` is called
- **THEN** an error is thrown with a message derived from the response status and any error body

### Requirement: Cursor pagination helper

The shared HTTP layer SHALL provide a `paginate<T>()` async-iterable helper that walks Atlassian Cloud's `{values, next}` cursor pattern.

#### Scenario: Yields each value across pages

- **GIVEN** an endpoint whose first response is `{values: [a, b], next: "...page2"}`
- **AND** whose second response is `{values: [c, d]}` (no `next` field)
- **WHEN** `paginate<T>(url)` is iterated to completion
- **THEN** the iterator yields `a`, `b`, `c`, `d` in order

#### Scenario: Single-page response

- **GIVEN** an endpoint whose response is `{values: [a, b]}` with no `next`
- **WHEN** `paginate<T>(url)` is iterated to completion
- **THEN** the iterator yields `a`, `b` and terminates

#### Scenario: Empty response

- **GIVEN** an endpoint whose response is `{values: []}`
- **WHEN** `paginate<T>(url)` is iterated
- **THEN** the iterator terminates without yielding any value

#### Scenario: Authentication is shared with request

- **WHEN** `paginate<T>(url)` makes its underlying requests
- **THEN** each request uses the same Basic auth header as `request<T>()`
