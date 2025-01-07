import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { afterEach, beforeEach, describe, it } from 'mocha';

describe('Scenario-based E2E Tests', () => {
  let workspaceRoot: string;

  before(async () => {
    // Wait for the extension to be activated
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify that our commands are registered
    const commands = await vscode.commands.getCommands();
    const requiredCommands = [
      'ai-pack.generateMarkdown',
      'ai-pack.generateMarkdownRoot',
    ];

    // Wait for commands to be registered
    let retries = 0;
    while (retries < 10) {
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
    assert.ok(
      commands.includes('ai-pack.generateMarkdown'),
      'generateMarkdown command should be registered',
    );
    assert.ok(
      commands.includes('ai-pack.generateMarkdownRoot'),
      'generateMarkdownRoot command should be registered',
    );
  });

  beforeEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
  });

  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const files = await vscode.workspace.findFiles('**/context.md');
    for (const file of files) {
      try {
        await vscode.workspace.fs.delete(file);
      } catch (error) {
        console.error(`Failed to delete file ${file.fsPath}:`, error);
      }
    }
  });

  describe('Empty Project Scenario', () => {
    it('should handle empty project appropriately', async () => {
      const emptyProjectPath = path.join(
        workspaceRoot,
        'scenarios',
        'empty-project',
      );

      await vscode.commands.executeCommand(
        'ai-pack.generateMarkdown',
        vscode.Uri.file(emptyProjectPath),
      );

      const markdownFiles = await vscode.workspace.findFiles('**/context.md');
      assert.strictEqual(
        markdownFiles.length,
        1,
        'Should generate markdown for empty project',
      );

      const content = await vscode.workspace.fs.readFile(markdownFiles[0]);
      const markdownContent = content.toString();

      assert.ok(
        markdownContent.includes('Empty Project'),
        'Should include project name',
      );
      assert.ok(
        markdownContent.includes('README.md'),
        'Should include README file',
      );
      assert.ok(
        markdownContent.includes('testing the AI Context Generator'),
        'Should include README content',
      );
    });
  });

  describe('Nested Project Scenario', () => {
    it('should handle nested directory structure', async () => {
      const nestedProjectPath = path.join(
        workspaceRoot,
        'scenarios',
        'nested-project',
      );

      await vscode.commands.executeCommand(
        'ai-pack.generateMarkdown',
        vscode.Uri.file(nestedProjectPath),
      );

      const markdownFiles = await vscode.workspace.findFiles('**/context.md');
      assert.strictEqual(
        markdownFiles.length,
        1,
        'Should generate markdown for nested project',
      );

      const content = await vscode.workspace.fs.readFile(markdownFiles[0]);
      const markdownContent = content.toString();

      // Verify structure is captured
      assert.ok(
        markdownContent.includes('src/'),
        'Should include src directory',
      );
      assert.ok(
        markdownContent.includes('test/'),
        'Should include test directory',
      );
      assert.ok(
        markdownContent.includes('docs/'),
        'Should include docs directory',
      );

      // Verify file content is captured
      assert.ok(
        markdownContent.includes('dateUtils.ts'),
        'Should include utility file',
      );
      assert.ok(
        markdownContent.includes('Button.tsx'),
        'Should include component file',
      );
      assert.ok(
        markdownContent.includes('api.md'),
        'Should include documentation file',
      );
    });

    it('should generate accurate summaries for nested components', async () => {
      const componentsPath = path.join(
        workspaceRoot,
        'scenarios',
        'nested-project',
        'src',
        'components',
      );

      await vscode.commands.executeCommand(
        'ai-pack.generateMarkdown',
        vscode.Uri.file(componentsPath),
      );

      const markdownFiles = await vscode.workspace.findFiles('**/context.md');
      const content = await vscode.workspace.fs.readFile(markdownFiles[0]);
      const markdownContent = content.toString();

      assert.ok(
        markdownContent.includes('Button.tsx'),
        'Should include Button component',
      );
      assert.ok(
        markdownContent.includes('React'),
        'Should identify React components',
      );
    });
  });

  describe('Large Project Scenario', () => {
    it('should handle large project structure', async () => {
      const largeProjectPath = path.join(
        workspaceRoot,
        'scenarios',
        'large-project',
      );

      await vscode.commands.executeCommand(
        'ai-pack.generateMarkdown',
        vscode.Uri.file(largeProjectPath),
      );

      const markdownFiles = await vscode.workspace.findFiles('**/context.md');
      assert.strictEqual(
        markdownFiles.length,
        1,
        'Should generate markdown for large project',
      );

      const content = await vscode.workspace.fs.readFile(markdownFiles[0]);
      const markdownContent = content.toString();

      // Verify all major sections are captured
      assert.ok(
        markdownContent.includes('components/'),
        'Should include components section',
      );
      assert.ok(
        markdownContent.includes('services/'),
        'Should include services section',
      );
      assert.ok(
        markdownContent.includes('utils/'),
        'Should include utils section',
      );
      assert.ok(
        markdownContent.includes('types/'),
        'Should include types section',
      );

      // Verify specific files are included
      assert.ok(
        markdownContent.includes('Button.tsx'),
        'Should include Button component',
      );
      assert.ok(
        markdownContent.includes('api.ts'),
        'Should include API service',
      );
      assert.ok(
        markdownContent.includes('format.ts'),
        'Should include format utility',
      );
      assert.ok(
        markdownContent.includes('user.ts'),
        'Should include user types',
      );
    });

    it('should generate accurate type information', async () => {
      const typesPath = path.join(
        workspaceRoot,
        'scenarios',
        'large-project',
        'src',
        'types',
      );

      await vscode.commands.executeCommand(
        'ai-pack.generateMarkdown',
        vscode.Uri.file(typesPath),
      );

      const markdownFiles = await vscode.workspace.findFiles('**/context.md');
      const content = await vscode.workspace.fs.readFile(markdownFiles[0]);
      const markdownContent = content.toString();

      assert.ok(
        markdownContent.includes('interface User'),
        'Should include User interface',
      );
      assert.ok(
        markdownContent.includes('interface Config'),
        'Should include Config interface',
      );
      assert.ok(
        markdownContent.includes('theme:'),
        'Should include type properties',
      );
    });
  });
});
