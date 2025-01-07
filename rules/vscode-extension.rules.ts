// rules/patterns/tools/vscode-extension.rules.ts
import { RuleMetadata } from './rule-metadata.types';

/**
 * VSCode Extension Development Rules: tools – Rule Metadata
 * - Outlines best practices for creating, organizing, and publishing Visual Studio Code extensions
 */
export const VSCodeExtensionRules: RuleMetadata = {
  id: 'vscode-extension-best-practices',
  version: '1.0.0',
  category: 'editor',
  type: 'vscode-extension',
  priority: 'critical',
  applicability: {
    // Applies to VSCode extension projects (TypeScript/JavaScript)
    filePatterns: ['**/*.ts', '**/*.js'],
    // Look for typical VSCode extension references
    contentPatterns: [
      'vscode.extensions',
      'vscode.commands',
      'activate',
      'deactivate',
      'onDidChangeActiveTextEditor',
    ],
  },
  validation: {
    // Example lint rule or custom plugin to enforce extension structure
    lintRules: ['@cortals/vscode/enforce-extension-patterns'],
  },
};

/**
 * VSCode Extension Development Patterns & Guidelines
 */
export const VSCodeExtensionPatterns = {
  /**
   * 1. Project Structure
   */
  projectStructure: {
    description:
      'Organize your extension’s source files and configuration for clarity and maintainability.',
    patterns: {
      recommendedLayout: {
        pattern: `
/my-vscode-extension
├── src
│   ├── extension.ts       # Main entry point (activate/deactivate)
│   ├── commands           # Separate directory for command implementations
│   └── utils              # Reusable utilities/helpers
├── package.json           # Contains extension metadata
├── tsconfig.json          # TypeScript config
├── .vscodeignore          # Files to exclude from packaging
└── README.md              # Documentation
        `,
        examples: [
          `// Keep extension.ts as the primary activation file`,
          `// Group related commands or features into their own directories`,
        ],
      },
    },
    rules: [
      'Place activation logic in a single, well-defined file (e.g., extension.ts)',
      'Use subfolders to group commands, utilities, or feature-specific code',
      'Maintain a clean .vscodeignore to avoid bundling unnecessary files',
    ],
  },

  /**
   * 2. Activation Events & Lifecycle
   */
  activationLifecycle: {
    description:
      'Define when your extension loads (on command, on file type, etc.) and manage resources properly.',
    patterns: {
      packageJsonActivation: {
        pattern: `
// In package.json
"activationEvents": [
  "onCommand:myExtension.helloWorld",
  "onLanguage:javascript"
],
        `,
        examples: [
          `// Only activate on specific commands or file types`,
          `// Avoid "onStartupFinished" unless absolutely necessary (can slow overall startup)`,
        ],
      },
      deactivateExample: {
        pattern: `
export function deactivate(): void {
  // Dispose resources, clear intervals/timeouts, etc.
}
        `,
        examples: [
          `// Gracefully clean up to prevent memory leaks`,
          `// Deactivation might not always be called, so keep logic minimal`,
        ],
      },
    },
    rules: [
      'Use granular activation events to avoid slowing VSCode startup',
      'Release resources in deactivate(), especially if using watchers or timers',
      'Avoid global listeners unless they’re critical to your extension’s function',
    ],
  },

  /**
   * 3. Commands & Context
   */
  commandsContext: {
    description:
      'Register commands in package.json and implement them in code with clear, user-friendly naming.',
    patterns: {
      commandRegistration: {
        pattern: `
// package.json
"contributes": {
  "commands": [
    {
      "command": "myExtension.helloWorld",
      "title": "My Extension: Hello World"
    }
  ]
}
        `,
        examples: [
          `// Provide descriptive command titles`,
          `// Prefix commands with your extension name`,
        ],
      },
      commandImplementation: {
        pattern: `
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const helloCommand = vscode.commands.registerCommand('myExtension.helloWorld', () => {
    vscode.window.showInformationMessage('Hello from My Extension!');
  });
  context.subscriptions.push(helloCommand);
}
        `,
        examples: [
          `// Provide a short, logical message or action`,
          `// Add command disposables to context.subscriptions for easy cleanup`,
        ],
      },
    },
    rules: [
      'Prefix commands with your extension ID or a namespace (e.g., myExtension.*)',
      'Register all commands in package.json for discoverability',
      'Push command disposables into context.subscriptions to prevent leaks',
    ],
  },

  /**
   * 4. Extension Testing
   */
  extensionTesting: {
    description:
      'Use VSCode’s built-in test runner or external frameworks (Mocha/Jest) to verify functionality.',
    patterns: {
      testExample: {
        pattern: `
// src/test/extension.test.ts
import * as vscode from 'vscode';
import * as assert from 'assert';

suite('My Extension Test Suite', () => {
  test('Command registration', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('myExtension.helloWorld'));
  });
});
        `,
        examples: [
          `// Check that your command is registered`,
          `// Test actual extension behavior if feasible (e.g., open document, run command)`,
        ],
      },
    },
    rules: [
      'Write unit or integration tests to ensure your commands behave correctly',
      'Test activation events, command registration, and critical code paths',
      'Use VSCode test runner scaffolding (yo code) or a known test library for extension testing',
    ],
  },

  /**
   * 5. Publishing & Marketplace
   */
  publishingMarketplace: {
    description:
      'Prepare your extension for publishing, including versioning, changelogs, and keywords for discoverability.',
    patterns: {
      vscePublish: {
        pattern: `
# Install vsce
npm install -g vsce

# Then in your project:
vsce package
vsce publish
        `,
        examples: [
          `// "vsce package" creates a .vsix file`,
          `// "vsce publish" sends to the Marketplace (needs a Personal Access Token)`,
        ],
      },
      packageJsonMetadata: {
        pattern: `
// package.json
{
  "name": "my-awesome-extension",
  "displayName": "My Awesome Extension",
  "description": "Short description of what it does",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.70.0"
  },
  "categories": ["Other"]
  // ...
}
        `,
        examples: [
          `// Provide a clear displayName and description`,
          `// Make sure engines.vscode is up to date with supported versions`,
        ],
      },
    },
    rules: [
      'Use semantic versioning (semver) for your extension versions',
      'Provide a descriptive README and changelog',
      'Add relevant keywords/categories in package.json to improve discoverability in the Marketplace',
    ],
  },

  /**
   * 6. Performance Considerations
   */
  performance: {
    description:
      'Minimize performance impact by limiting extension overhead and deferring heavy computations.',
    patterns: {
      lazyLoad: {
        pattern: `
"activationEvents": ["onCommand:myExtension.helloWorld"]
        `,
        examples: [
          `// Only load heavy logic when the user runs your command`,
          `// Avoid onStartupFinished or * events if your extension is large`,
        ],
      },
      backgroundTasks: {
        pattern: `
// Use setTimeout or a background process sparingly
// Release resources in deactivate if you start intervals or watchers
        `,
        examples: [
          `// Large or frequent background tasks can slow the editor`,
          `// Use on-demand or event-driven approaches where possible`,
        ],
      },
    },
    rules: [
      'Defer initialization until a user actually needs your functionality',
      'Unload or dispose watchers, intervals, or event listeners when not in use',
      'Profile your extension if performance issues arise (e.g., extension startup time)',
    ],
  },

  /**
   * 7. Logging & Error Handling
   */
  loggingErrorHandling: {
    description:
      'Log extension events or errors in a structured way and handle unexpected issues gracefully.',
    patterns: {
      loggerExample: {
        pattern: `
import * as vscode from 'vscode';

function logInfo(message: string) {
  const outputChannel = vscode.window.createOutputChannel('MyExtension');
  outputChannel.appendLine(\`[INFO] \${message}\`);
}

function logError(error: Error) {
  const outputChannel = vscode.window.createOutputChannel('MyExtension');
  outputChannel.appendLine(\`[ERROR] \${error.message}\`);
  outputChannel.show(true);
}
        `,
        examples: [
          `// Provide a dedicated output channel for extension logs`,
          `// Show output channel or fallback UI if a critical error occurs`,
        ],
      },
    },
    rules: [
      'Use an OutputChannel for extension-specific logs instead of console.log',
      'Surface critical errors in a user-friendly way (notifications, error messages)',
      'Gracefully degrade or disable features if they fail instead of crashing VSCode',
    ],
  },
};
