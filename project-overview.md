# AI Context Generator VSCode Extension

## Overview
This is a VSCode extension that generates AI-powered context summaries for directories and root folders in a workspace. It provides commands to generate context for a selected directory or the root folder.

## File Structure
The key directories and files are:

```
src/
  extension.ts   - Main extension entry point
  backend/       - Backend code for the extension
    commands/    - Implements extension commands 
    services/    - Services used by the extension (file system, markdown generation)
    types.ts     - Backend type definitions
    utils/       - Backend utility functions
  di/            - Dependency injection setup
  shared/        - Code shared between backend and webview
  test/          - Extension tests  
  webview/       - Webview UI code
    components/  - React components 
    contexts/    - React contexts
    hooks/       - Custom React hooks
    utils/       - Webview utility functions
    App.tsx      - Main webview app component
    index.tsx    - Webview entry point
.vscode/         - VSCode-specific config
  launch.json    - Launch config for debugging
  settings.json  - Extension-specific settings
  tasks.json     - Build tasks
images/          - Extension images/icons  
```

## Extension Activation
- Defined in `package.json` under `activationEvents`
- No automatic activation, only activated on command

## Commands
- `ai-pack.generateMarkdown` - Generate context summary for selected directory 
- `ai-pack.generateMarkdownRoot` - Generate context summary for workspace root

## Webview
- UI for displaying generated context summary
- Built with React, CSS modules, VSCode Webview UI Toolkit
- Communicates with extension via `postMessage`

## Services
- `FileService` - File system operations
- `markdownService` - Generating markdown content for webview

## Shared Code
- Types, config, error handling, logging shared between backend and webview

## Dependency Injection
- Uses a simple `Container` class to provide dependencies
- Services registered in `extension.ts` and `backend/commands/index.ts`

## Configuration
- Extension-specific settings in `.vscode/settings.json`
- Configures code formatting, linting, file exclusions

## Important Notes
- Automatically ignores common directories like `node_modules`, `dist`, `.git` etc.
- Limits max file size and directory size to prevent performance issues

## Tech Stack
- TypeScript
- Node.js
- React
- Webpack
- ESLint
- Prettier
- Jest

## Data Flow
1. User invokes a command to generate context
2. Command handler calls `markdownService` to generate content
3. `markdownService` uses `FileService` to read workspace files and directories 
4. Generated markdown content is sent to webview via `postMessage`
5. Webview displays the generated context summary
6. User can copy the summary content from the webview 