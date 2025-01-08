/* eslint-disable no-case-declarations */
import * as vscode from 'vscode';
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

const container = initializeContainer();

export function getContainer(): Container {
  return container;
}

interface Command {
  execute(param: vscode.Uri | vscode.ExtensionContext): Promise<void>;
}

export class GenerateMarkdownCommand implements Command {
  private readonly fileService: FileService;
  private readonly performanceService: PerformanceService;
  private readonly container: ContainerBase;

  constructor(container: ContainerBase) {
    this.container = container;
    this.fileService = container.resolve<FileService>('fileService');
    this.performanceService =
      container.resolve<PerformanceService>('performanceService');
  }

  async execute(param: vscode.Uri): Promise<void> {
    const rootDir = param.fsPath;

    try {
      if (this.fileService.isLargeDirectory(rootDir)) {
        const proceed = await vscode.window.showWarningMessage(
          'This directory contains a large number of files. Processing may take longer and consume more memory. Do you want to continue?',
          'Yes',
          'No',
        );

        if (proceed !== 'Yes') {
          return;
        }
      }

      await generateMarkdown(
        rootDir,
        rootDir,
        this.container.context,
        false,
        false,
        this.fileService,
        this.container,
      );

      await this.performanceService.measureDirectoryScanning(
        rootDir,
        rootDir,
        false,
      );
    } catch (error) {
      logger.error('Error in GenerateMarkdownCommand:', { error });
      vscode.window.showErrorMessage(
        `Failed to generate markdown: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}

export class GenerateMarkdownRootCommand implements Command {
  private readonly fileService: FileService;
  private readonly performanceService: PerformanceService;
  private readonly container: ContainerBase;

  constructor(container: ContainerBase) {
    this.container = container;
    this.fileService = container.resolve<FileService>('fileService');
    this.performanceService =
      container.resolve<PerformanceService>('performanceService');
  }

  async execute(_param: vscode.ExtensionContext): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder is open');
      return;
    }

    try {
      const isLarge = this.fileService.isLargeDirectory(workspaceRoot);
      if (isLarge) {
        const proceed = await vscode.window.showWarningMessage(
          'This workspace contains a large number of files. Processing may take longer and consume more memory. Do you want to continue?',
          'Yes',
          'No',
        );

        if (proceed !== 'Yes') {
          return;
        }
      }

      await generateMarkdown(
        workspaceRoot,
        workspaceRoot,
        this.container.context,
        false,
        true,
        this.fileService,
        this.container,
      );

      await this.performanceService.measureDirectoryScanning(
        workspaceRoot,
        workspaceRoot,
        false,
      );
    } catch (error) {
      logger.error('Error in GenerateMarkdownRootCommand:', { error });
      vscode.window.showErrorMessage(
        `Failed to generate root markdown: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private getWorkspaceRoot(): string | undefined {
    if (
      !vscode.workspace.workspaceFolders ||
      vscode.workspace.workspaceFolders.length === 0
    ) {
      return undefined;
    }
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
}

export function registerCommands(
  context: vscode.ExtensionContext,
  container: Container,
): void {
  container.setContext(context);

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
    if (commandName === 'ai-pack.generateMarkdown') {
      context.subscriptions.push(
        vscode.commands.registerCommand(commandName, (uri: vscode.Uri) =>
          command.execute(uri),
        ),
      );
    } else {
      context.subscriptions.push(
        vscode.commands.registerCommand(commandName, () =>
          command.execute(context),
        ),
      );
    }
  }
}

export function setupMessageHandler(
  panel: vscode.WebviewPanel,
  _context: vscode.ExtensionContext,
  _container: ContainerBase,
): void {
  panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
    try {
      switch (message.command) {
        case 'error':
          logger.error('Webview error:', {
            error: message.error,
            componentStack: message.componentStack,
          });
          vscode.window.showErrorMessage(
            `Webview error: ${message.error}. Check the developer tools for more details.`,
          );
          break;

        case 'reloadWebview':
          if (panel) {
            panel.webview.html = await generateWebviewContent();
          }
          break;

        default:
          logger.warn('Unknown command received:', {
            command: message.command,
          });
      }
    } catch (error) {
      logger.error('Error handling message:', { error });
      vscode.window.showErrorMessage(
        `Error handling message: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  });
}

async function generateWebviewContent(): Promise<string> {
  // Implementation details...
  return '';
}

export function getWebviewPanel(): vscode.WebviewPanel | undefined {
  return currentPanel;
}
