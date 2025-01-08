# AI Context Generator VSCode Extension

## Overview

This VSCode extension generates AI-powered context summaries for directories and root folders in a workspace. It analyzes project structure and generates meaningful documentation to help developers understand codebases quickly.

## Architecture

### File Structure

```
src/
  extension.ts   - Main extension entry point and DI setup
  backend/       
    commands/    - Command implementations (generateMarkdown, generateMarkdownRoot)
    services/    - Core services (FileService, MarkdownService)
    types.ts     - Backend type definitions
    utils/       - Backend utilities (file processing, path handling)
  di/            - Dependency injection container and configuration
  shared/        - Shared types, constants, and utilities
  test/          - Unit and integration tests
  webview/       - React-based UI
    components/  - Reusable UI components
    contexts/    - React context providers
    hooks/       - Custom React hooks for state management
    utils/       - Frontend utilities
    App.tsx      - Main webview component
    index.tsx    - Webview entry point
```

### Data Flow

1. Command Invocation
   - User triggers command via VSCode command palette
   - Command handler receives workspace/directory path
   - Container provides required service instances

2. Content Generation
   - FileService scans directory structure
   - Applies file/directory filters and size limits
   - MarkdownService generates context summary
   - Content formatted according to templates

3. UI Rendering
   - Generated content sent to webview via postMessage
   - React components render markdown content
   - User can interact with generated summary

## Core Components

### Extension Host

- Activation triggered by specific commands only
- Manages service lifecycle and dependency injection
- Handles command registration and execution
- Maintains webview panel state

### Services

FileService:
- File system operations and directory traversal
- File filtering and size limit enforcement
- Path normalization and validation

MarkdownService:
- Content generation and formatting
- Template processing
- Metadata extraction

### Webview UI

- Built with React and VSCode Webview UI Toolkit
- Responsive layout with VSCode theme integration
- Real-time content updates
- Copy functionality for generated content

## Security & Performance

### Security Measures
- Restricted file system access
- Input validation and sanitization
- Secure message passing between extension and webview

### Performance Optimizations
- File size limits: Individual files capped at 1MB
- Directory size limits: Max 1000 files per scan
- Lazy loading of webview content
- Caching of generated summaries

## Development

### Setup
1. Clone repository
2. Run `pnpm install`
3. Open in VSCode
4. Press F5 to launch extension development host

### Testing
- Jest for unit tests
- VSCode extension testing framework
- Coverage requirements: 80% minimum

### Building & Packaging
1. `pnpm run compile` - TypeScript compilation
2. `pnpm run package` - Create VSIX package
3. `pnpm run deploy` - Publish to marketplace

## Configuration

### Extension Settings
- `ai-pack.maxFileSize`: Maximum file size to process
- `ai-pack.excludePatterns`: Glob patterns to ignore
- `ai-pack.templatePath`: Custom template location

### VSCode Integration
- Commands registered in package.json
- Keybindings customizable via keybindings.json
- Context menu integration for directories

## API Documentation

### Command API
- `generateMarkdown(uri: vscode.Uri): Promise<void>`
- `generateMarkdownRoot(): Promise<void>`

### Service API
FileService:
- `scanDirectory(path: string): Promise<FileTree>`
- `readFile(path: string): Promise<string>`

MarkdownService:
- `generateContent(files: FileTree): Promise<string>`
- `applyTemplate(content: string): string`

### Webview Messages
```typescript
interface WebviewMessage {
  type: 'update' | 'copy' | 'error';
  payload: any;
}
```

## Tech Stack

- TypeScript 4.x
- Node.js 16+
- React 18
- VSCode Extension API
- Webpack 5
- Jest
- ESLint & Prettier
