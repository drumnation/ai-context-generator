/* eslint-disable no-case-declarations */
import * as vscode from 'vscode';
import path from 'path';
import { setupHotReload } from '../utils/hotReload';
import { Container } from '../../di/container';
import { ContainerBase } from '../../di/container-base';
import { FileService } from '../services/fileService';
import { PerformanceService } from '../services/performanceService';
import { logger } from '../../shared/logger';
import { WebviewMessage } from '../types';
import { WebviewPanelProvider } from '../../di/types';
import { generateMarkdown } from '../services/markdownGenerator';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export class WebviewPanelService implements WebviewPanelProvider {
  getOrCreateWebviewPanel(
    context: vscode.ExtensionContext,
    container: ContainerBase,
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
}

// Initialize container at module level
function initializeContainer(): Container {
  const newContainer = new Container();
  const fileService = new FileService();
  const performanceService = new PerformanceService(fileService);
  const webviewPanelService = new WebviewPanelService();

  newContainer.register('fileService', fileService);
  newContainer.register('performanceService', performanceService);
  newContainer.register('webviewPanelService', webviewPanelService);

  return newContainer;
}

// Initialize container immediately
const container = initializeContainer();

// Export container getter
export function getContainer(): Container {
  return container;
}

interface Command {
  execute(context: vscode.ExtensionContext): Promise<void>;
}

class GenerateMarkdownCommand implements Command {
  constructor(private container: Container) {}

  async execute(context: vscode.ExtensionContext): Promise<void> {
    const fileService = this.container.resolve<FileService>('fileService');
    const performanceService =
      this.container.resolve<PerformanceService>('performanceService');

    const rootPath = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : '';
    const directoryPath = rootPath;
    const includeDotFolders = path.basename(directoryPath).startsWith('.');

    // Profile directory scanning
    await performanceService.profileDirectoryScanning(directoryPath);

    await generateMarkdown(
      rootPath,
      directoryPath,
      context,
      includeDotFolders,
      false,
      fileService,
      this.container,
    );
  }
}

class GenerateMarkdownRootCommand implements Command {
  constructor(private container: Container) {}

  async execute(context: vscode.ExtensionContext): Promise<void> {
    const fileService = this.container.resolve<FileService>('fileService');
    const performanceService =
      this.container.resolve<PerformanceService>('performanceService');

    if (vscode.workspace.workspaceFolders) {
      const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

      // Profile directory scanning
      await performanceService.profileDirectoryScanning(rootPath);

      await generateMarkdown(
        rootPath,
        rootPath,
        context,
        false,
        true,
        fileService,
        this.container,
      );
    } else {
      vscode.window.showInformationMessage('No workspace folder is open.');
    }
  }
}

// Export command registration function
export function registerCommands(
  context: vscode.ExtensionContext,
  container: Container,
): void {
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

// Export message handler setup function
export function setupMessageHandler(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  container: ContainerBase,
): void {
  panel.webview.onDidReceiveMessage(
    async (message: WebviewMessage) => {
      try {
        const fileService = container.resolve<FileService>('fileService');
        const performanceService =
          container.resolve<PerformanceService>('performanceService');

        switch (message.command) {
          case 'error':
            logger.error('Webview error:', {
              error: message.error,
              componentStack: message.componentStack,
            });
            vscode.window.showErrorMessage(
              `Webview error: ${message.error}. Check the developer tools for more details.`,
            );
            return;
          case 'reloadWebview':
            if (panel) {
              setupHotReload(context, panel);
            }
            return;
          case 'closeWebview':
            panel.dispose();
            return;
          case 'showMessage':
            vscode.window.showInformationMessage(message.text as string);
            return;
          case 'changeMode':
            const rootPath = vscode.workspace.workspaceFolders
              ? vscode.workspace.workspaceFolders[0].uri.fsPath
              : '';
            if (message.mode === 'root') {
              await performanceService.profileDirectoryScanning(rootPath);
              await generateMarkdown(
                rootPath,
                rootPath,
                context,
                false,
                true,
                fileService,
                container,
              );
            } else {
              const lastSelectedDir = rootPath;
              await performanceService.profileDirectoryScanning(
                lastSelectedDir,
              );
              await generateMarkdown(
                rootPath,
                lastSelectedDir,
                context,
                false,
                false,
                fileService,
                container,
              );
            }
            return;
          case 'loadRootMode':
            const rootDir = vscode.workspace.workspaceFolders
              ? vscode.workspace.workspaceFolders[0].uri.fsPath
              : '';
            if (fileService.isLargeDirectory(rootDir)) {
              await panel.webview.postMessage({
                command: 'showWarning',
                text: 'This is a large repository. Loading root mode may be slow or cause the extension to crash.',
              });
            }
            await performanceService.profileDirectoryScanning(rootDir);
            await generateMarkdown(
              rootDir,
              rootDir,
              context,
              false,
              true,
              fileService,
              container,
            );
            return;
          case 'loadDirectoryMode':
            const currentDir = vscode.window.activeTextEditor
              ? path.dirname(vscode.window.activeTextEditor.document.uri.fsPath)
              : vscode.workspace.workspaceFolders
                ? vscode.workspace.workspaceFolders[0].uri.fsPath
                : '';
            await performanceService.profileDirectoryScanning(currentDir);
            await generateMarkdown(
              currentDir,
              currentDir,
              context,
              false,
              false,
              fileService,
              container,
            );
            return;
          case 'checkRepoSize':
            const workspaceRoot = vscode.workspace.workspaceFolders
              ? vscode.workspace.workspaceFolders[0].uri.fsPath
              : '';
            const isLarge = fileService.isLargeDirectory(workspaceRoot);
            await panel.webview.postMessage({
              command: 'repoSizeResult',
              isLarge: isLarge,
            });
            return;
        }
      } catch (error) {
        logger.error('Error in message handler:', { error });
        if (error instanceof Error) {
          vscode.window.showErrorMessage(`Error: ${error.message}`);
        } else {
          vscode.window.showErrorMessage('An unexpected error occurred');
        }
      }
    },
    undefined,
    context.subscriptions,
  );
}

// Export webview panel getter
export function getWebviewPanel(): vscode.WebviewPanel | undefined {
  return currentPanel;
}
