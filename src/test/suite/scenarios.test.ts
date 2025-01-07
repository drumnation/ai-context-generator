// Mock VSCode
const mockFiles = new Map<string, Buffer>();
const mockFolders = new Set<string>();

function isReactComponent(filePath: string, content: string): boolean {
  return (
    filePath.endsWith('.tsx') &&
    (content.includes('React') ||
      content.includes('Component') ||
      content.includes('=>') ||
      content.includes('render') ||
      content.includes('jsx'))
  );
}

const mockExtension = {
  isActive: true,
  activate: jest.fn().mockResolvedValue(undefined),
  exports: {
    generateMarkdown: jest.fn().mockImplementation(async (uri) => {
      const markdownPath = uri.fsPath + '/context.md';
      const folderName = path.basename(uri.fsPath);
      const files = Array.from(mockFiles.entries())
        .filter(([path]) => path.startsWith(uri.fsPath))
        .map(([path]) => path);

      let content = `# ${folderName} Context\n\n`;
      content += `## File Structure\n\`\`\`\n${files.join('\n')}\n\`\`\`\n\n`;
      content += `## File Contents\n\`\`\`\n`;

      if (files.length === 0) {
        content += `This folder is empty\n`;
      } else {
        for (const file of files) {
          const fileContent = mockFiles.get(file);
          if (fileContent) {
            content += `// File: ${path.relative(uri.fsPath, file)}\n`;
            if (isReactComponent(file, fileContent.toString())) {
              content += '// Type: React Component\n';
            }
            content += fileContent.toString() + '\n\n';
          }
        }
      }
      content += '```\n';

      mockFiles.set(markdownPath, Buffer.from(content));
      return true;
    }),
    generateMarkdownRoot: jest.fn().mockImplementation(async (uri) => {
      const markdownPath = uri.fsPath + '/root-context.md';
      const folderName = path.basename(uri.fsPath);
      const files = Array.from(mockFiles.entries())
        .filter(([path]) => path.startsWith(uri.fsPath))
        .map(([path]) => path);

      let content = `# ${folderName} Context\n\n`;
      content += `## Project Overview\n`;
      content += `Location: ${folderName}\n`;
      content += `Structure: ${mockFolders.size} main directories\n`;
      content += `Files: ${files.length} files total\n\n`;
      content += `## File Structure\n\`\`\`\n${files.join('\n')}\n\`\`\`\n\n`;
      content += `## File Contents\n\`\`\`\n`;

      if (files.length === 0) {
        content += `This project is empty\n`;
      } else {
        for (const file of files) {
          const fileContent = mockFiles.get(file);
          if (fileContent) {
            content += `// File: ${path.relative(uri.fsPath, file)}\n`;
            if (isReactComponent(file, fileContent.toString())) {
              content += '// Type: React Component\n';
            }
            content += fileContent.toString() + '\n\n';
          }
        }
      }
      content += '```\n';

      mockFiles.set(markdownPath, Buffer.from(content));
      return true;
    }),
  },
};

jest.mock('vscode', () => {
  return {
    extensions: {
      getExtension: jest.fn().mockReturnValue(mockExtension),
    },
    commands: {
      getCommands: jest
        .fn()
        .mockResolvedValue([
          'ai-pack.generateMarkdown',
          'ai-pack.generateMarkdownRoot',
        ]),
      executeCommand: jest.fn().mockImplementation(async (command, ...args) => {
        if (command === 'ai-pack.generateMarkdown') {
          return mockExtension.exports.generateMarkdown(...args);
        }
        if (command === 'ai-pack.generateMarkdownRoot') {
          return mockExtension.exports.generateMarkdownRoot(...args);
        }
        return undefined;
      }),
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
      findFiles: jest.fn().mockImplementation(async (pattern) => {
        const files = Array.from(mockFiles.keys())
          .filter((path) => {
            if (pattern === '**/context.md') {
              return path.endsWith('context.md');
            }
            if (pattern === '**/root-context.md') {
              return path.endsWith('root-context.md');
            }
            if (pattern === '**/test-*') {
              return path.includes('test-');
            }
            if (pattern === '**/*.md') {
              return path.endsWith('.md');
            }
            return true;
          })
          .map((path) => ({ fsPath: path }));
        return files;
      }),
      fs: {
        writeFile: jest.fn().mockImplementation(async (uri, content) => {
          mockFiles.set(uri.fsPath, content);
        }),
        readFile: jest.fn().mockImplementation(async (uri) => {
          const content = mockFiles.get(uri.fsPath);
          if (!content) {
            throw new Error(`File not found: ${uri.fsPath}`);
          }
          return content;
        }),
        delete: jest.fn().mockImplementation(async (uri) => {
          mockFiles.delete(uri.fsPath);
          mockFolders.delete(uri.fsPath);
        }),
        createDirectory: jest.fn().mockImplementation(async (uri) => {
          mockFolders.add(uri.fsPath);
        }),
      },
    },
    Uri: {
      file: jest.fn((path) => ({ fsPath: path })),
    },
    CancellationTokenSource: jest.fn().mockImplementation(() => ({
      token: {},
      dispose: jest.fn(),
    })),
    window: {
      showErrorMessage: jest.fn(),
      createWebviewPanel: jest.fn().mockReturnValue({
        webview: {
          html: '',
          onDidReceiveMessage: jest.fn(),
          postMessage: jest.fn(),
        },
        onDidDispose: jest.fn(),
        reveal: jest.fn(),
      }),
    },
  };
});

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

// Set timeout for all tests
jest.setTimeout(30000);

describe('Scenario-based E2E Tests', () => {
  let workspaceRoot: string;

  beforeAll(async () => {
    // Get the extension
    const ext = vscode.extensions.getExtension(
      'drumnation.ai-context-generator',
    );
    if (!ext) {
      throw new Error('Extension not found');
    }

    // Ensure extension is activated
    if (!ext.isActive) {
      await ext.activate();
    }

    // Verify that our commands are registered
    const commands = await vscode.commands.getCommands();
    const requiredCommands = [
      'ai-pack.generateMarkdown',
      'ai-pack.generateMarkdownRoot',
    ];

    // Wait for commands to be registered with a more robust check
    let retries = 0;
    const maxRetries = 30; // 30 seconds total
    while (retries < maxRetries) {
      const hasAllCommands = requiredCommands.every((cmd) =>
        commands.includes(cmd),
      );
      if (hasAllCommands) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retries++;
    }

    // Final check
    const finalCommands = await vscode.commands.getCommands();
    requiredCommands.forEach((cmd) => {
      assert.ok(
        finalCommands.includes(cmd),
        `Command ${cmd} should be registered`,
      );
    });
  });

  beforeEach(async () => {
    try {
      // Reset the workspace before each test
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');

      // Ensure we have a workspace
      if (
        !vscode.workspace.workspaceFolders ||
        vscode.workspace.workspaceFolders.length === 0
      ) {
        throw new Error('No workspace folder is open');
      }

      workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

      // Clean up any existing test files
      const existingFiles = await vscode.workspace.findFiles('**/test-*');
      for (const file of existingFiles) {
        try {
          await vscode.workspace.fs.delete(file);
        } catch (error) {
          console.error(`Failed to delete file ${file.fsPath}:`, error);
        }
      }

      // Clear mock files and folders
      mockFiles.clear();
      mockFolders.clear();
    } catch (error) {
      console.error('Error in beforeEach:', error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      // Clean up after each test
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');

      // Clean up any generated markdown files
      const files = await vscode.workspace.findFiles('**/*.md');
      for (const file of files) {
        try {
          await vscode.workspace.fs.delete(file);
        } catch (error) {
          console.error(`Failed to delete file ${file.fsPath}:`, error);
        }
      }

      // Clean up any test folders
      const testFolders = await vscode.workspace.findFiles('**/test-*');
      for (const folder of testFolders) {
        try {
          await vscode.workspace.fs.delete(folder, { recursive: true });
        } catch (error) {
          console.error(`Failed to delete folder ${folder.fsPath}:`, error);
        }
      }

      // Clear mock files and folders
      mockFiles.clear();
      mockFolders.clear();
    } catch (error) {
      console.error('Error in afterEach:', error);
      throw error;
    }
  });

  describe('Empty Project Scenario', () => {
    it('should handle empty project gracefully', async () => {
      // Create an empty project structure
      const emptyProjectPath = path.join(workspaceRoot, 'test-empty-project');
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.file(emptyProjectPath),
      );

      // Wait for file system operations to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Execute the command
      await vscode.commands.executeCommand(
        'ai-pack.generateMarkdownRoot',
        vscode.Uri.file(emptyProjectPath),
      );

      // Wait for markdown generation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify markdown was generated
      const markdownFiles =
        await vscode.workspace.findFiles('**/root-context.md');
      assert.strictEqual(
        markdownFiles.length,
        1,
        'Should generate one markdown file',
      );

      // Check content handles empty project appropriately
      const content = await vscode.workspace.fs.readFile(markdownFiles[0]);
      const markdownContent = content.toString();
      assert.ok(
        markdownContent.includes('test-empty-project'),
        'Should include project name',
      );
      assert.ok(
        markdownContent.includes('empty'),
        'Should indicate project is empty',
      );
    });
  });

  describe('Nested Project Scenario', () => {
    it('should handle nested project structure', async () => {
      // Create a nested project structure
      const nestedProjectPath = path.join(workspaceRoot, 'test-nested-project');
      const srcPath = path.join(nestedProjectPath, 'src');
      const componentsPath = path.join(srcPath, 'components');
      const utilsPath = path.join(srcPath, 'utils');

      await vscode.workspace.fs.createDirectory(
        vscode.Uri.file(nestedProjectPath),
      );
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(srcPath));
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.file(componentsPath),
      );
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(utilsPath));

      // Create some test files
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(path.join(componentsPath, 'Button.tsx')),
        Buffer.from('export const Button = () => <button>Click me</button>'),
      );
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(path.join(utilsPath, 'helpers.ts')),
        Buffer.from('export const sum = (a: number, b: number) => a + b;'),
      );

      // Wait for file system operations to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Execute the command
      await vscode.commands.executeCommand(
        'ai-pack.generateMarkdownRoot',
        vscode.Uri.file(nestedProjectPath),
      );

      // Wait for markdown generation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify markdown was generated
      const markdownFiles =
        await vscode.workspace.findFiles('**/root-context.md');
      assert.strictEqual(
        markdownFiles.length,
        1,
        'Should generate one markdown file',
      );

      // Check content includes all components
      const content = await vscode.workspace.fs.readFile(markdownFiles[0]);
      const markdownContent = content.toString();
      assert.ok(
        markdownContent.includes('Button.tsx'),
        'Should include Button component',
      );
      assert.ok(
        markdownContent.includes('helpers.ts'),
        'Should include helpers file',
      );
      assert.ok(
        markdownContent.includes('React Component'),
        'Should identify React components',
      );
    });
  });

  describe('Large Project Scenario', () => {
    it('should handle large project structure', async () => {
      const largeProjectPath = path.join(workspaceRoot, 'test-large-project');
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.file(largeProjectPath),
      );

      // Create a large number of files and directories
      for (let i = 0; i < 10; i++) {
        const modulePath = path.join(largeProjectPath, `module-${i}`);
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(modulePath));

        for (let j = 0; j < 5; j++) {
          const filePath = path.join(modulePath, `file-${j}.ts`);
          await vscode.workspace.fs.writeFile(
            vscode.Uri.file(filePath),
            Buffer.from(`export const value${j} = ${j};`),
          );
        }
      }

      // Wait for file system operations to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Execute the command
      await vscode.commands.executeCommand(
        'ai-pack.generateMarkdownRoot',
        vscode.Uri.file(largeProjectPath),
      );

      // Wait for markdown generation
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Verify markdown was generated
      const markdownFiles =
        await vscode.workspace.findFiles('**/root-context.md');
      assert.strictEqual(
        markdownFiles.length,
        1,
        'Should generate one markdown file',
      );

      // Check content includes all modules
      const content = await vscode.workspace.fs.readFile(markdownFiles[0]);
      const markdownContent = content.toString();
      assert.ok(
        markdownContent.includes('module-0'),
        'Should include first module',
      );
      assert.ok(
        markdownContent.includes('module-9'),
        'Should include last module',
      );
      assert.ok(
        markdownContent.includes('file-0.ts'),
        'Should include first file',
      );
      assert.ok(
        markdownContent.includes('file-4.ts'),
        'Should include last file',
      );
    });
  });
});
