/* eslint-disable no-case-declarations */
import * as vscode from 'vscode';
import { setupHotReload } from '../utils/hotReload';
import { Container } from '../../di/container';
import { ContainerBase } from '../../di/container-base';
import { FileService } from '../services/fileService';
import { PerformanceService } from '../services/performanceService';
import { logger } from '../../shared/logger';
import {
  WebviewMessage,
  CheckRepoSizeMessage,
  WebviewLifecycleMessage,
  MessageAcknowledgment,
} from '../../shared/types';
import { WebviewPanelProvider } from '../../di/types';
import { generateMarkdown } from '../services/markdownGenerator';
import { MessageManager } from '../../shared/communication';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

// Create a message manager instance to handle communication
const commandMessageManager = new MessageManager('command');

// Map to store resolvers for pending acknowledgements (kept for backward compatibility)
export const pendingAckResolvers = new Map<string, () => void>();

// Define interface for commands
export interface Command {
  execute(param: unknown): Promise<void>;
}

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
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
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

// Add new simplified command class
export class SimpleMarkdownCommand implements Command {
  private readonly fileService: FileService;
  private readonly container: ContainerBase;

  constructor(container: ContainerBase) {
    this.container = container;
    this.fileService = container.resolve<FileService>('fileService');
  }

  async execute(param: vscode.Uri): Promise<void> {
    const rootDir = param.fsPath;
    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || rootDir;

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

      // Import the simplified markdown generator function
      const { generateSimplifiedMarkdown } = await import(
        '../services/simplifiedMarkdown'
      );

      // Call the simplified version directly
      await generateSimplifiedMarkdown(
        workspaceRoot,
        rootDir,
        this.container.context,
        false,
        workspaceRoot === rootDir, // isRoot
        this.fileService,
      );
    } catch (error) {
      logger.error('Error in SimpleMarkdownCommand:', { error });
      vscode.window.showErrorMessage(
        `Failed to generate markdown: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
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

  // Add simplified commands
  commandRegistry.set(
    'ai-pack.simpleMarkdown',
    new SimpleMarkdownCommand(container),
  );

  for (const [commandName, command] of commandRegistry) {
    if (
      commandName === 'ai-pack.generateMarkdown' ||
      commandName === 'ai-pack.simpleMarkdown'
    ) {
      context.subscriptions.push(
        vscode.commands.registerCommand(commandName, (uri: vscode.Uri) =>
          command.execute(uri),
        ),
      );
    } else {
      context.subscriptions.push(
        vscode.commands.registerCommand(commandName, () =>
          command.execute(undefined),
        ),
      );
    }
  }
}

export function setupMessageHandler(
  panel: vscode.WebviewPanel,
  _context: vscode.ExtensionContext,
  container: ContainerBase,
): void {
  const fileService = container.resolve<FileService>('fileService');

  // Set panel in message manager
  commandMessageManager.setWebviewPanel(panel);

  panel.webview.onDidReceiveMessage(
    async (message: WebviewMessage & { operationId?: string }) => {
      let path: string | undefined;
      if (message.command === 'checkRepoSize') {
        path = (message as CheckRepoSizeMessage).path;
      }

      logger.info('[MessageHandler] Raw message received:', message);

      try {
        // Handle message acknowledgment
        if (message.command === 'messageAck') {
          // Use a type predicate to verify it's a properly formed MessageAcknowledgment
          const isAckMessage = (msg: unknown): msg is MessageAcknowledgment => {
            return (
              typeof msg === 'object' &&
              msg !== null &&
              'command' in msg &&
              'id' in msg &&
              'status' in msg
            );
          };

          if (isAckMessage(message)) {
            commandMessageManager.handleAcknowledgment(message);
          } else {
            logger.error(
              '[MessageHandler] Received malformed messageAck without required properties',
              message,
            );
          }
          return;
        }

        // Handle webview lifecycle messages
        if (
          message.command === 'webviewMounted' ||
          message.command === 'webviewUnmounting'
        ) {
          // Type guard for WebviewLifecycleMessage
          const isLifecycleMessage = (
            msg: unknown,
          ): msg is WebviewLifecycleMessage => {
            return (
              typeof msg === 'object' &&
              msg !== null &&
              'command' in msg &&
              (msg.command === 'webviewMounted' ||
                msg.command === 'webviewUnmounting')
            );
          };

          if (isLifecycleMessage(message)) {
            if (message.command === 'webviewMounted') {
              logger.info('[MessageHandler] Webview mounted');
            } else {
              // Handle unmounting - clean up pending operations if any provided
              logger.info(
                `[MessageHandler] Webview unmounting with ${message.pendingOperations?.length ?? 0} pending operations`,
              );

              // If webview reported pending operations, log them specifically
              if (
                message.pendingOperations &&
                message.pendingOperations.length > 0
              ) {
                logger.info(
                  `[MessageHandler] Pending operations at unmount: ${message.pendingOperations.join(', ')}`,
                );

                // Clean up pending operations reported by the webview
                commandMessageManager.cleanupPendingOperations();
              }
            }
          } else {
            logger.error(
              '[MessageHandler] Received malformed lifecycle message',
              message,
            );
          }
          return;
        }

        // Handle heartbeat response
        if (message.command === 'heartbeatResponse') {
          logger.info(
            `[MessageHandler] Received heartbeatResponse at ${Date.now()}`,
          );
          commandMessageManager.updateHeartbeat();
          return;
        }

        // Handle fileTreeReceived ack
        if (message.command === 'fileTreeReceived') {
          logger.info(
            `[MessageHandler] Received fileTreeReceived ack for operation ${message.operationId} at ${Date.now()}`,
          );
          // Potentially resolve a specific promise related to file tree generation here if needed
          return;
        }

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
              logger.info('Reload webview requested (implementation pending)');
            }
            break;

          case 'checkRepoSize':
            if (typeof path !== 'string' || !path) {
              const errorMsg =
                'checkRepoSize command received without a valid path.';
              logger.error(errorMsg, { message });
              panel.webview.postMessage({
                command: 'repoSizeResult',
                error: errorMsg,
                path: path ?? 'unknown',
                isLarge: false,
              });
              break;
            }
            try {
              const isLarge = fileService.isLargeDirectory(path);
              logger.info('Checked directory size:', { path, isLarge });
              panel.webview.postMessage({
                command: 'repoSizeResult',
                isLarge: isLarge,
                path: path,
              });
            } catch (err) {
              const errorMsg = `Error checking directory size for ${path}`;
              logger.error(errorMsg, { path, error: err });
              vscode.window.showErrorMessage(
                `${errorMsg}: ${err instanceof Error ? err.message : 'Unknown error'}`,
              );
              panel.webview.postMessage({
                command: 'repoSizeResult',
                error:
                  err instanceof Error
                    ? err.message
                    : 'Unknown error checking size',
                path: path,
                isLarge: false,
              });
            }
            break;

          case 'loadRootMode':
            logger.info('Received loadRootMode command from webview');
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
              const errorMsg = 'No workspace folder is open to load root mode.';
              logger.error(errorMsg);
              vscode.window.showErrorMessage(errorMsg);
              panel.webview.postMessage({
                command: 'showError',
                error: errorMsg,
              });
              break;
            }
            const rootPath = workspaceFolders[0].uri.fsPath;
            const context = container.context;

            if (!context) {
              const errorMsg = 'Extension context not found in container.';
              logger.error(errorMsg);
              vscode.window.showErrorMessage(errorMsg);
              panel.webview.postMessage({
                command: 'showError',
                error: errorMsg,
              });
              break;
            }

            logger.info(
              'Initiating root markdown generation from webview request',
              { rootPath },
            );
            try {
              await generateMarkdown(
                rootPath,
                rootPath,
                context,
                false,
                true,
                fileService,
                container,
              );
              logger.info(
                'Successfully generated root markdown from webview request',
              );
            } catch (error) {
              const errorMsg = `Failed to generate root markdown from webview request`;
              logger.error(errorMsg, { rootPath, error });
              vscode.window.showErrorMessage(
                `${errorMsg}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              );
              panel.webview.postMessage({
                command: 'showError',
                error:
                  error instanceof Error
                    ? error.message
                    : 'Unknown error generating root context',
              });
            }
            break;

          case 'fileTreeReceived':
            if (message.operationId) {
              const resolve = pendingAckResolvers.get(message.operationId);
              if (resolve) {
                logger.info(
                  `[MessageHandler] Received fileTreeReceived ack for operation: ${message.operationId}`,
                );
                resolve();
                pendingAckResolvers.delete(message.operationId);
              } else {
                logger.warn(
                  `[MessageHandler] Received fileTreeReceived ack for unknown/timed out operation: ${message.operationId}`,
                );
              }
            } else {
              logger.warn(
                '[MessageHandler] Received fileTreeReceived ack without operationId.',
              );
            }
            break;

          case 'ping':
            // Respond to ping from webview to confirm communication channel is working
            logger.info(
              '[MessageHandler] Received ping from webview, sending pong',
            );

            panel.webview
              .postMessage({
                command: 'pong',
              })
              .then(
                (success) =>
                  logger.info(
                    `[MessageHandler] Pong response sent: ${success}`,
                  ),
                (error) =>
                  logger.error('[MessageHandler] Error sending pong response', {
                    error,
                  }),
              );
            break;

          default:
            // Using unknown instead of any for type safety
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const unknownCommandPayload =
              'payload' in message
                ? (message as unknown as { payload: unknown }).payload
                : message;

            logger.warn('Unknown command received:', {
              command: message.command,
              payload: unknownCommandPayload,
            });
        }
      } catch (error) {
        logger.error('[MessageHandler] Error processing message:', {
          error,
          message,
        });
      }
    },
    null,
    _context.subscriptions,
  );

  // Add listener disposal logic for when the panel itself is disposed
  panel.onDidDispose(
    () => {
      logger.info(
        '[MessageHandler] Panel disposed, emergency isolation sequence starting.',
      );

      // Create a local variable to hold the panel reference while we clean up
      const disposingPanel = panel;

      // 1. Create isolation by setting global currentPanel to undefined immediately
      // This ensures no new messages can be sent to this panel from other parts of the extension
      if (currentPanel === disposingPanel) {
        logger.info('[MessageHandler] Clearing global panel reference');
        currentPanel = undefined;
      }

      // 2. First clean up the message manager pending operations
      try {
        logger.info(
          '[MessageHandler] Cleaning up pending message manager operations',
        );
        commandMessageManager.cleanupPendingOperations();
      } catch (error) {
        logger.error(
          '[MessageHandler] Error during pending operations cleanup',
          { error },
        );
        // Continue with cleanup despite errors
      }

      // 3. Then clear the webview panel reference
      try {
        logger.info('[MessageHandler] Clearing webview panel reference');
        commandMessageManager.clearWebviewPanel();
      } catch (error) {
        logger.error('[MessageHandler] Error during panel reference cleanup', {
          error,
        });
        // Continue with cleanup despite errors
      }

      // 4. Backward compatibility - clean up pendingAckResolvers
      try {
        const pendingAckCount = pendingAckResolvers.size;
        if (pendingAckCount > 0) {
          logger.warn(
            `[MessageHandler] Cleaning up ${pendingAckCount} legacy pending ack resolvers due to panel disposal.`,
          );
          pendingAckResolvers.forEach((resolve, operationId) => {
            logger.warn(
              `[MessageHandler] Rejecting pending ack for operation ${operationId} due to panel disposal.`,
            );
            pendingAckResolvers.delete(operationId);
          });
        }
      } catch (error) {
        logger.error('[MessageHandler] Error during ack resolvers cleanup', {
          error,
        });
        // Continue with cleanup despite errors
      }

      logger.info(
        '[MessageHandler] Panel disposal cleanup complete, panel completely isolated.',
      );
    },
    null /* this context */,
    _context.subscriptions /* ensure disposal */,
  );
}

/*
async function generateWebviewContent(): Promise<string> {
  // Implementation details...
  // This function might be needed later for webview reloading
  return '';
}
*/

export function getWebviewPanel(): vscode.WebviewPanel | undefined {
  return currentPanel;
}
