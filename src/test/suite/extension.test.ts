import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { afterEach, beforeEach, describe, it } from 'mocha';

describe('Extension E2E Test Suite', () => {
  let workspaceRoot: string;

  before(async () => {
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
    it('should generate markdown for a specific folder', async function () {
      this.timeout(10000); // Increase timeout for this test

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

    it('should handle empty folders gracefully', async function () {
      this.timeout(10000); // Increase timeout for this test

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
