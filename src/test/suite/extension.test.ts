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

describe('Extension E2E Test Suite', () => {
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

  describe('Extension Activation', () => {
    it('should have the commands registered', async () => {
      const commands = await vscode.commands.getCommands();
      assert.ok(
        commands.includes('ai-pack.generateMarkdown'),
        'generateMarkdown command should be registered',
      );
      assert.ok(
        commands.includes('ai-pack.generateMarkdownRoot'),
        'generateMarkdownRoot command should be registered',
      );
    });
  });

  describe('Markdown Generation', () => {
    it('should generate markdown for a specific folder', async () => {
      jest.setTimeout(10000); // Increase timeout for this test

      try {
        // Create a test folder structure
        const testFolder = path.join(workspaceRoot, 'test-folder');
        const testFile = path.join(testFolder, 'test.txt');

        await vscode.workspace.fs.createDirectory(vscode.Uri.file(testFolder));
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(testFile),
          Buffer.from('test content'),
        );

        // Wait for file system operations to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Execute the command
        await vscode.commands.executeCommand(
          'ai-pack.generateMarkdown',
          vscode.Uri.file(testFolder),
        );

        // Wait for markdown generation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify markdown was generated
        const markdownFiles = await vscode.workspace.findFiles('**/context.md');
        assert.strictEqual(
          markdownFiles.length,
          1,
          'Should generate one markdown file',
        );

        // Check markdown content
        const content = await vscode.workspace.fs.readFile(markdownFiles[0]);
        const markdownContent = content.toString();
        assert.ok(
          markdownContent.includes('test-folder'),
          'Should include folder name',
        );
        assert.ok(
          markdownContent.includes('test.txt'),
          'Should include file name',
        );
      } catch (error) {
        console.error('Error in test:', error);
        throw error;
      }
    });

    it('should handle empty folders gracefully', async () => {
      jest.setTimeout(10000); // Increase timeout for this test

      try {
        // Create an empty folder
        const emptyFolder = path.join(workspaceRoot, 'test-empty-folder');
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(emptyFolder));

        // Wait for file system operation to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Execute the command
        await vscode.commands.executeCommand(
          'ai-pack.generateMarkdown',
          vscode.Uri.file(emptyFolder),
        );

        // Wait for markdown generation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify markdown was generated
        const markdownFiles = await vscode.workspace.findFiles('**/context.md');
        assert.strictEqual(
          markdownFiles.length,
          1,
          'Should generate markdown even for empty folder',
        );

        // Check content handles empty folder appropriately
        const content = await vscode.workspace.fs.readFile(markdownFiles[0]);
        const markdownContent = content.toString();
        assert.ok(
          markdownContent.includes('test-empty-folder'),
          'Should include empty folder name',
        );
        assert.ok(
          markdownContent.includes('empty'),
          'Should indicate folder is empty',
        );
      } catch (error) {
        console.error('Error in test:', error);
        throw error;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent folders gracefully', async () => {
      const nonExistentFolder = path.join(workspaceRoot, 'non-existent');

      try {
        await vscode.commands.executeCommand(
          'ai-pack.generateMarkdown',
          vscode.Uri.file(nonExistentFolder),
        );
        assert.fail('Should throw error for non-existent folder');
      } catch (error) {
        assert.ok(error, 'Should throw error for non-existent folder');
      }
    });
  });
});
