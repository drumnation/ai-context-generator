/* eslint-disable no-case-declarations */
import * as vscode from 'vscode';
import { generateMarkdown } from '../services/markdownService';
import path from 'path';
import { setupHotReload } from '../utils/hotReload';
import { Container } from '../../di/container';
import { FileService } from '../services/fileService';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

interface Command {
  execute(context: vscode.ExtensionContext): Promise<void>;
}

class GenerateMarkdownCommand implements Command {
  constructor(private container: Container) {}

  async execute(context: vscode.ExtensionContext): Promise<void> {
    const fileService = this.container.resolve('fileService') as FileService;
    const rootPath = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : '';
    const directoryPath = rootPath; // Use the root path directly
    const includeDotFolders = path.basename(directoryPath).startsWith('.');

    getOrCreateWebviewPanel(context, this.container);

    await generateMarkdown(
      rootPath,
      directoryPath,
      context,
      includeDotFolders,
      false,
      fileService,
    );
  }
}

class GenerateMarkdownRootCommand implements Command {
  constructor(private container: Container) {}

  async execute(context: vscode.ExtensionContext): Promise<void> {
    const fileService = this.container.resolve('fileService') as FileService;
    if (vscode.workspace.workspaceFolders) {
      const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

      getOrCreateWebviewPanel(context, this.container);

      await generateMarkdown(
        rootPath,
        rootPath,
        context,
        false,
        true,
        fileService,
      );
    } else {
      vscode.window.showInformationMessage('No workspace folder is open.');
    }
  }
}

export function registerCommands(
  context: vscode.ExtensionContext,
  container: Container,
) {
  const commandRegistry = new Map<string, Command>();
  commandRegistry.set(
    'ai-pack.generateMarkdown',
    new GenerateMarkdownCommand(container),
  );
  commandRegistry.set(
    'ai-pack.generateMarkdownRoot',
    new GenerateMarkdownRootCommand(container),
  );

  for (const [commandName, command] of commandRegistry) {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandName, () =>
        command.execute(context),
      ),
    );
  }
}

export function getOrCreateWebviewPanel(
  context: vscode.ExtensionContext,
  container: Container,
): vscode.WebviewPanel {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    return currentPanel;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'aiContext',
    'AI-Context',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  });

  setupMessageHandler(currentPanel, context, container);
  setupHotReload(context, currentPanel);

  return currentPanel;
}

export function setupMessageHandler(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  container: Container,
) {
  panel.webview.onDidReceiveMessage(
    async (message) => {
      const fileService = container.resolve('fileService') as FileService;

      switch (message.command) {
        case 'showMessage':
          vscode.window.showInformationMessage(message.text);
          return;
        case 'changeMode':
          const rootPath = vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : '';
          if (message.mode === 'root') {
            await generateMarkdown(
              rootPath,
              rootPath,
              context,
              false,
              true,
              fileService,
            );
          } else {
            const lastSelectedDir = rootPath;
            await generateMarkdown(
              rootPath,
              lastSelectedDir,
              context,
              false,
              false,
              fileService,
            );
          }
          return;
        case 'loadRootMode':
          const rootDir = vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : '';
          if (fileService.isLargeDirectory(rootDir)) {
            panel.webview.postMessage({
              command: 'showWarning',
              text: 'This is a large repository. Loading root mode may be slow or cause the extension to crash.',
            });
          }
          await generateMarkdown(
            rootDir,
            rootDir,
            context,
            false,
            true,
            fileService,
          );
          return;
        case 'loadDirectoryMode':
          const currentDir = vscode.window.activeTextEditor
            ? path.dirname(vscode.window.activeTextEditor.document.uri.fsPath)
            : vscode.workspace.workspaceFolders
              ? vscode.workspace.workspaceFolders[0].uri.fsPath
              : '';
          await generateMarkdown(
            currentDir,
            currentDir,
            context,
            false,
            false,
            fileService,
          );
          return;
        case 'checkRepoSize':
          const workspaceRoot = vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : '';
          const isLarge = fileService.isLargeDirectory(workspaceRoot);
          panel.webview.postMessage({
            command: 'repoSizeResult',
            isLarge: isLarge,
          });
          return;
      }
    },
    undefined,
    context.subscriptions,
  );
}

export function getWebviewPanel(): vscode.WebviewPanel | undefined {
  return currentPanel;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('AI-PACK EXTENSION IS NOW ACTIVE!');
  const container = new Container();
  container.register('fileService', new FileService());
  context.extension.exports.container = container;
  registerCommands(context, container);
}

export function deactivate() {}
