export const vsCodeExtensionTestingRuleset = {
  coreCycleProcess: {
    description: `
A structured approach for writing TypeScript/Jest tests for a VSCode extension.
We break this into distinct phases: Planning, Setup, Execution, and Review.
Each phase has specific rules, examples, and pitfalls to watch out for.
`,
    phases: [
      {
        phaseName: "Planning",
        phaseDescription: "Define the test scope, outline test cases, and determine success criteria.",
        rules: [
          "Identify core functionalities to test: commands, configuration, extension activation, etc.",
          "Determine expected outcomes and edge cases before writing test code."
        ],
        examples: [
          {
            ruleDescription: "Identify functionalities to test",
            codeSample: `// Example: A simple plan for testing command registration
// 1. The command is registered
// 2. The command executes with valid input
// 3. The command handles invalid input gracefully
// 4. Extension activates successfully when the command is called
`
          }
        ],
        pitfalls: [
          "Skipping edge cases like invalid inputs or missing configurations.",
          "Not confirming extension activation triggers or lifecycle events."
        ]
      },
      {
        phaseName: "Setup",
        phaseDescription: "Configure Jest, prepare VSCode test environment, and structure test files/folders.",
        rules: [
          "Use the official VSCode test utilities (vscode-test) to launch an instance of VSCode for integration tests.",
          "Enable TypeScript strict mode in tsconfig for accurate type-checking.",
          "Organize test files to mirror the extension’s folder structure."
        ],
        examples: [
          {
            ruleDescription: "Use vscode-test in Jest",
            codeSample: `// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // ...other config
};

// Example test using vscode-test
import * as vscode from 'vscode';
import { runTests } from '@vscode/test-electron';

test('Extension activates properly', async () => {
  const extensionPath = 'path/to/extension';
  const testWorkspace = 'path/to/workspace';
  
  await runTests({
    extensionDevelopmentPath: extensionPath,
    extensionTestsPath: 'dist/test/index.js',
    launchArgs: [testWorkspace, '--disable-extensions']
  });
  
  // Additional assertions or checks
});
`
          }
        ],
        pitfalls: [
          "Forgetting to install @types/jest or configuring ts-jest incorrectly.",
          "Not using the correct path for the extension development folder."
        ]
      },
      {
        phaseName: "Execution",
        phaseDescription: "Run tests, capture results, and handle any side effects or mock operations.",
        rules: [
          "Use mocks and stubs only where necessary (e.g., for network requests).",
          "Assert on extension states (e.g., context, workspace changes) after actions."
        ],
        examples: [
          {
            ruleDescription: "Mocking network requests",
            codeSample: `// Example using jest.fn()
const mockFetch = jest.fn();
global.fetch = mockFetch;

test('Command makes a network request', async () => {
  mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ result: 'success' }) });
  
  // Trigger the command in VSCode
  await vscode.commands.executeCommand('myExtension.someCommand');
  
  // Assertions
  expect(mockFetch).toHaveBeenCalledWith('https://example.com/api');
});
`
          }
        ],
        pitfalls: [
          "Over-mocking, which can obscure real issues in extension logic.",
          "Not cleaning up global mocks or side effects between tests."
        ]
      },
      {
        phaseName: "Review",
        phaseDescription: "Analyze test coverage, code readability, and maintainability.",
        rules: [
          "Aim for clear, concise tests that read like documentation.",
          "Review coverage reports to ensure all significant extension flows are tested."
        ],
        examples: [
          {
            ruleDescription: "Coverage check example",
            codeSample: `// jest.config.js snippet
module.exports = {
  // ...
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
`
          }
        ],
        pitfalls: [
          "Focusing solely on coverage percentage rather than meaningful test scenarios.",
          "Allowing complex logic to slip by without thorough test review."
        ]
      }
    ]
  },

  gettingStartedGuide: {
    description: `
Basic orientation for developers new to testing VSCode extensions with TypeScript and Jest.
Covers initial setup and minimal examples.
`,
    steps: [
      {
        step: "Install Dependencies",
        example: "npm install --save-dev jest ts-jest @types/jest @vscode/test-electron"
      },
      {
        step: "Add Basic Scripts",
        example: `// package.json
{
  "scripts": {
    "test": "jest"
  }
}
`
      },
      {
        step: "Create First Test",
        example: `// __tests__/helloWorld.test.ts
import { helloWorld } from '../src/helloWorld';

test('helloWorld returns correct greeting', () => {
  expect(helloWorld()).toBe('Hello, VSCode!');
});
`
      }
    ]
  },

  bestPractices: {
    description: `
Recommended approaches for writing clean, reliable tests.
Includes guidelines for readability, structure, and reliability.
`,
    guidelines: [
      {
        name: "Clear Test Names",
        goodExample: `test('activates extension when command is run', () => { /* ... */ });`,
        badExample: `test('it works', () => { /* ... */ });`,
        explanation: "Descriptive test names make the test suite more maintainable and readable."
      },
      {
        name: "Consistent Folder Structure",
        goodExample: `// Good
// src/
// tests/
//   integration/
//   unit/
`,
        badExample: `// Scattered test files in random folders without clear organization`,
        explanation: "Keep tests in a dedicated directory, mirroring the source structure where possible."
      },
      {
        name: "Use TypeScript Types",
        goodExample: `interface MyTestContext { settings: vscode.WorkspaceConfiguration; }`,
        badExample: `// Relying on 'any' or ignoring types entirely`,
        explanation: "Leveraging TypeScript ensures safer refactoring and consistent behavior across the test suite."
      }
    ]
  },

  domainSpecificPatterns: {
    description: `
Patterns unique to testing VSCode extensions—like extension activation, command execution, and workspace manipulation.
`,
    specialCases: [
      {
        name: "Extension Activation",
        consideration: "Make sure to wait for `activate()` to resolve before checking extension state.",
        example: `// Example: Extension activation test
import * as vscode from 'vscode';

test('Extension activates correctly', async () => {
  const extension = vscode.extensions.getExtension('myPublisher.myExtension');
  if (!extension) throw new Error('Extension not found');
  
  await extension.activate();
  expect(extension.isActive).toBe(true);
});
`
      },
      {
        name: "Workspace Manipulation",
        consideration: "Keep test files in a temporary workspace to avoid polluting the user’s environment.",
        example: `// Example using a temp workspace
test('Creates a new file', async () => {
  const uri = vscode.Uri.file('/tmp/testFile.txt');
  const doc = await vscode.workspace.openTextDocument(uri);
  expect(doc).toBeDefined();
});
`
      }
    ]
  },

  warningSigns: {
    description: `
Indications that the test suite or approach might be problematic. Common mistakes and anti-patterns.
`,
    redFlags: [
      "Tests relying on the developer’s local settings or environment variables unintentionally.",
      "Large, monolithic tests that try to cover everything in one place.",
      "No clear separation between unit and integration tests."
    ],
    antiPatterns: [
      "Hardcoding environment paths or requiring specific OS for the tests to pass.",
      "Skipping key flows like extension deactivation or error handling conditions."
    ]
  },

  improvementGuidelines: {
    description: `
How to iteratively enhance your test suite with refactoring, pattern adoption, and advanced techniques.
`,
    recommendations: [
      {
        name: "Incremental Refactoring",
        method: "Refactor tests in small steps, ensuring existing coverage remains intact.",
        example: `// Example: Extracting reusable setup
beforeEach(async () => {
  // Common extension activation logic
});
`
      },
      {
        name: "Advanced Automation",
        method: "Use CI/CD pipelines to run tests across different OS and VSCode versions.",
        example: `// Example GitHub Actions snippet
name: "CI"
on: [push, pull_request]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Use Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm test
`
      }
    ],
    evolutionExample: `
Begin with basic unit tests for core functions. Progress to integration tests for command execution.
Finally, adopt continuous testing in CI/CD for robust quality assurance.
`
  }
};
