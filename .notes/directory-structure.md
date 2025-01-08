# Directory Structure

## Root Level Files
- `.cursorignore`: Specifies files and directories to be ignored by Cursor.
- `.cursorrules`: Configuration file for Cursor's AI features.
- `.eslintignore`: Specifies files and directories to be ignored by ESLint.
- `.eslintrc.js`: Configuration file for ESLint.
- `.eslintrc.test.json`: Configuration file for ESLint for test files.
- `.gitignore`: Specifies files and directories to be ignored by Git.
- `.npmrc`: Configuration file for npm.
- `.prettierrc`: Configuration file for Prettier.
- `.vscode-test.mjs`: Configuration file for VS Code test runner.
- `.vscodeignore`: Specifies files and directories to be ignored when packaging the extension.
- `CHANGELOG.md`: Records changes made to the project over time.
- `LICENSE.md`: Specifies the license under which the project is distributed.
- `README.md`: Provides a general overview of the project.
- `ai-context-generator-0.0.10.vsix`: Packaged VS Code extension file.
- `esbuild.js`: Configuration file for esbuild.
- `jest.config.js`: Configuration file for Jest.
- `nx.json`: Configuration file for Nx.
- `package.json`: Contains metadata about the project, including dependencies and scripts.
- `project-overview.md`: High-level overview of the project.
- `tsconfig.json`: Configuration file for TypeScript.
- `tsconfig.spec.json`: Configuration file for TypeScript for test files.
- `vsc-extension-quickstart.md`: Quick start guide for VS Code extensions.
- `watch.js`: Script for watching files for changes.
- `webpack.config.ts`: Configuration file for Webpack.

## Backend (src/backend/)
- **commands/**: Implements VS Code extension commands.
  - `index.ts`: Registers and handles all extension commands.
- **services/**: Contains core backend services.
  - `fileService.ts`: Handles file system operations, directory traversal, and filtering.
  - `markdownGenerator.ts`: Generates markdown content from file information.
  - `markdownService.ts`: Formats and processes markdown content.
  - `performanceService.ts`: Monitors and optimizes performance of backend operations.
  - `queueService.ts`: Manages a queue for processing large tasks.
  - **__tests__/**: Contains unit tests for backend services.
- **utils/**: Provides utility functions for the backend.
  - `hotReload.ts`: Implements hot reload functionality for development.

## Dependency Injection (src/di/)
- **container-base.ts**: Defines the base class for the dependency injection container.
- **container.ts**: Configures and manages dependency injection for the extension.
- **types.ts**: Defines types related to dependency injection.
- **__tests__/**: Contains unit tests for the dependency injection system.

## Shared (src/shared/)
- **config.ts**: Defines shared configuration constants used across the extension.
- **errorHandling.ts**: Provides utilities for handling errors.
- **logger.ts**: Implements the logging system for the extension.
- **messageTypes.ts**: Defines message types for communication between the extension and webview.
- **types.ts**: Defines shared type definitions used across the extension.

## Testing (src/test/)
- **extension.test.ts**: Contains integration tests for the extension.
- **queueService.test.ts**: Contains unit tests for the queue service.
- **runTest.ts**: Configures the test runner.
- **setup.ts**: Sets up the test environment.
- **suite/**: Contains test suites.
  - `extension.test.ts`: Contains end-to-end (E2E) tests for the extension.
  - `scenarios.test.ts`: Contains scenario-based E2E tests.

## Webview (src/webview/)
- **App.tsx**: Main entry point for the webview application.
- **components/**: Contains reusable React UI components.
  - `Body.tsx`: Main content container for the webview.
  - `CombinedContentSection.tsx`: Displays the combined content of selected files.
  - `ControlsSection.tsx`: Contains UI controls and actions for the webview.
  - `ErrorBoundary.tsx`: Handles errors within the webview.
  - `ErrorMessageSection.tsx`: Displays error messages in the webview.
  - `FileTreeSection.tsx`: Visualizes the file tree structure.
  - `Head.tsx`: Manages the document head for the webview.
  - `Styles.ts`: Defines styled components and theme definitions.
- **contexts/**: Contains React context providers.
  - `AppContext.tsx`: Manages the application state for the webview.
- **hooks/**: Contains custom React hooks.
  - `useAppState.ts`: Manages the application state.
  - `useFileTree.ts`: Provides logic for file tree manipulation.
  - `useVscodeMessaging.ts`: Handles communication with the VS Code extension.
- **styles/**: Contains CSS styles for the webview.
  - `error-boundary.css`: Styles for the error boundary component.
  - `index.css`: Global styles for the webview.
  - `toolkit.css`: Styles for the VS Code UI toolkit.
  - `webview.css`: Webview-specific styles.
- **utils/**: Provides utility functions for the webview.
  - `messageHandlers.ts`: Handles messages from the extension.
  - `vscode-api.ts`: Integrates with the VS Code API.

## Test Fixtures (test-fixtures/)
- **sample-project/**: Contains a sample project for testing.
  - `README.md`: README for the sample project.
- **scenarios/**: Contains test scenarios.
  - `create-samples.sh`: Script to create sample files.
  - **empty-project/**: Empty project for testing.
    - `README.md`: README for the empty project.
  - **large-project/**: Large project for testing.
    - `README.md`: README for the large project.
    - **src/**: Source code for the large project.
      - **components/**: React components.
      - **models/**: Data models.
      - **services/**: Backend services.
      - **types/**: Type definitions.
      - **utils/**: Utility functions.
  - **nested-project/**: Nested project for testing.
    - `README.md`: README for the nested project.
    - **docs/**: Documentation files.
    - **src/**: Source code for the nested project.
      - **components/**: React components.
      - **config/**: Configuration files.
      - **utils/**: Utility functions.
    - **test/**: Test files for the nested project.
      - **components/**: Component tests.
      - **config/**: Config tests.
      - **utils/**: Utility tests.

## Rules (rules/)
- `analysis.rules.ts`: Rules for code analysis.
- `code-coverage-task.md`: Task list for code coverage.
- `directory-structure.md`: Documentation for the directory structure.
- `e2e-rules.ts`: Rules for end-to-end testing.
- `meeting-notes.md`: Notes from meetings.
- `project-overview.md`: High-level overview of the project.
- `regenerate-context.md`: Documentation for regenerating context.
- `task-list.md`: List of tasks for the project.
- `unit-tests.rules.ts`: Rules for unit testing.

## Output (out/)
- Contains compiled JavaScript files and source maps.
  - **backend/**: Compiled backend code.
  - **di/**: Compiled dependency injection code.
  - **shared/**: Compiled shared code.
  - **test/**: Compiled test code.
  - **webview/**: Compiled webview code.

## Coverage (coverage/)
- Contains code coverage reports.
  - `clover.xml`: Clover XML coverage report.
  - `coverage-final.json`: JSON coverage report.
  - `lcov-report/`: HTML coverage report.
  - `lcov.info`: LCOV coverage data.
