## ADDED Requirements

### Requirement: Confluence command routing

The CLI SHALL route `af confluence <subcommand>` to appropriate Confluence handlers.

#### Scenario: Confluence command with subcommand

- **GIVEN** the user runs `af confluence get 12345`
- **WHEN** the router processes the command
- **THEN** it delegates to the confluence command handler
- **AND** passes `get` as the subcommand and `12345` as an argument

#### Scenario: Confluence command without subcommand shows help

- **GIVEN** the user runs `af confluence`
- **WHEN** the router processes the command
- **THEN** it displays confluence-specific help information

### Requirement: Confluence page operations

The CLI SHALL support core page operations via subcommands.

#### Scenario: Get page details

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence get <page-id>`
- **THEN** the page content and metadata are displayed in markdown format
- **AND** the page body is converted from ADF to markdown

#### Scenario: List pages in a space

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence list MYSPACE`
- **THEN** pages from the space are displayed as a table

#### Scenario: Search with CQL

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence search "title = 'My Page'"`
- **THEN** matching pages are displayed

#### Scenario: Create page with inline body

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence create --space MYSPACE --title "Title" --body "Content"`
- **THEN** a new page is created with the body converted from markdown to ADF
- **AND** the page ID is displayed

#### Scenario: Create page with body from file

- **GIVEN** valid Atlassian credentials in environment
- **AND** a markdown file exists at the specified path
- **WHEN** the user runs `af confluence create --space MYSPACE --title "Title" --body-file ./doc.md`
- **THEN** the file content is read and used as the page body

#### Scenario: Create page missing required fields

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence create --title "Title"` (missing --space)
- **THEN** an error is displayed indicating --space and --title are required
- **AND** the CLI exits with code 1

#### Scenario: Update page content

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence update <page-id> --body "New content"`
- **THEN** the page content is updated
- **AND** the page version is automatically incremented

#### Scenario: Update page title

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence update <page-id> --title "New Title"`
- **THEN** the page title is updated

#### Scenario: Delete page

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence delete <page-id>`
- **THEN** the page is deleted

### Requirement: Confluence page hierarchy

The CLI SHALL support viewing page hierarchy.

#### Scenario: Show page tree

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence tree <page-id>`
- **THEN** the page and its children are displayed in a tree format

### Requirement: Confluence comment operations

The CLI SHALL support comment operations on pages.

#### Scenario: List comments

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence comments <page-id>`
- **THEN** footer comments on the page are displayed

#### Scenario: Add comment

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence comment <page-id> --add "Comment text"`
- **THEN** the comment is added to the page

### Requirement: Confluence label operations

The CLI SHALL support label management on pages.

#### Scenario: List labels

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence labels <page-id>`
- **THEN** labels on the page are displayed

#### Scenario: Add label

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence label <page-id> --add "my-label"`
- **THEN** the label is added to the page

#### Scenario: Remove label

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence label <page-id> --remove "my-label"`
- **THEN** the label is removed from the page

### Requirement: Confluence attachment operations

The CLI SHALL support file attachments on pages.

#### Scenario: List attachments

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence attachments <page-id>`
- **THEN** attachments on the page are displayed with filename, size, and type

#### Scenario: Upload attachment

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence attach <page-id> ./file.pdf`
- **THEN** the file is attached to the page

### Requirement: Confluence space operations

The CLI SHALL support space discovery operations.

#### Scenario: List spaces

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence spaces`
- **THEN** available spaces are displayed with key, name, and type

#### Scenario: Get space details

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence space MYSPACE`
- **THEN** space details are displayed

### Requirement: JSON output option

The CLI SHALL support JSON output for programmatic use.

#### Scenario: JSON output for page

- **GIVEN** valid Atlassian credentials in environment
- **WHEN** the user runs `af confluence get <page-id> --json`
- **THEN** the page is output as JSON instead of markdown

### Requirement: Lazy credential validation

The CLI SHALL validate Atlassian credentials only when confluence commands are executed.

#### Scenario: Missing credentials with confluence command

- **GIVEN** Atlassian credentials are not set in environment
- **WHEN** the user runs `af confluence spaces`
- **THEN** an error is displayed indicating missing configuration
- **AND** the CLI exits with code 1

#### Scenario: Missing credentials with other commands

- **GIVEN** Atlassian credentials are not set in environment
- **WHEN** the user runs `af help`
- **THEN** the command succeeds without error

### Requirement: Help documentation

The CLI SHALL include confluence commands in help output.

#### Scenario: General help includes confluence

- **GIVEN** the user runs `af help`
- **THEN** confluence commands are listed in the available commands

#### Scenario: Confluence-specific help

- **GIVEN** the user runs `af help confluence`
- **THEN** detailed confluence command help is displayed
- **AND** all subcommands and options are documented
