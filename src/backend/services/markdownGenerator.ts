import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../../shared/logger';
import { FileService } from './fileService';
import { ContainerBase } from '../../di/container-base';
import { WebviewPanelProvider } from '../../di/types';
import { ProcessingOptions, DEFAULT_CHUNK_OPTIONS } from '../../shared/types';
import { MessageManager } from '../../shared/communication';

const messageManager = new MessageManager('markdown');

async function _analyzeFileContent(content: string): Promise<string[]> {
  const insights: string[] = [];

  // Identify React components
  const isReactComponent =
    content.includes('import React') ||
    content.includes('from "react"') ||
    content.includes("from 'react'") ||
    (content.includes('<') && content.includes('/>')) || // JSX self-closing tag
    (content.includes('<') && content.includes('</') && content.includes('>')); // JSX opening/closing tags

  if (isReactComponent) {
    insights.push('React Component');

    // Check for component patterns
    if (
      content.includes('function') &&
      content.includes('return') &&
      content.includes('jsx')
    ) {
      insights.push('Functional Component');
    } else if (content.includes('=>') && content.includes('<')) {
      insights.push('Arrow Function Component');
    }
    if (
      content.includes('class') &&
      content.includes('extends React.Component')
    ) {
      insights.push('Class Component');
    }
    if (content.includes('props')) {
      insights.push('Uses Props');
    }
    if (content.includes('useState') || content.includes('useEffect')) {
      insights.push('Uses Hooks');
    }
  }

  return insights;
}

async function _generateProjectOverview(
  rootPath: string,
  fileService: FileService,
  options: ProcessingOptions,
): Promise<string> {
  // Try to find package.json for project info
  try {
    const packageJsonContent = await fileService.readFile(
      path.join(rootPath, 'package.json'),
    );
    const packageJson = JSON.parse(packageJsonContent);
    return `## Project Overview
Name: ${packageJson.name || 'Unknown'}
Description: ${packageJson.description || 'No description available'}
Version: ${packageJson.version || 'Unknown'}
Dependencies: ${Object.keys(packageJson.dependencies || {}).length} packages
`;
  } catch {
    // If no package.json, provide a basic overview
    const fileCount = await fileService.countFiles(rootPath, options);
    const dirs = await fileService.listDirectories(rootPath);
    return `## Project Overview
Location: ${path.basename(rootPath)}
Structure: ${dirs.length} main directories
Files: ${fileCount} files total
`;
  }
}

export async function generateMarkdown(
  rootPath: string,
  directoryPath: string,
  context: vscode.ExtensionContext,
  includeDotFolders: boolean,
  isRoot: boolean,
  fileService: FileService,
  container: ContainerBase,
): Promise<void> {
  const operationId = `generateMarkdown-${Date.now()}`;
  logger.info(`[${operationId}] Entering generateMarkdown function`, {
    rootPath,
    directoryPath,
    includeDotFolders,
    isRoot,
  });

  let panel: vscode.WebviewPanel | undefined;
  let processingStartedAcknowledged = false; // Flag for initial ack

  // Create progress indicator
  const progressPromise = vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: isRoot
        ? 'Generating AI Context for Root Folder'
        : 'Generating AI Context',
      cancellable: true,
    },
    async (progress, token) => {
      // --- Cancellation Handling ---
      const tokenSource = new vscode.CancellationTokenSource();
      token.onCancellationRequested(() => {
        logger.info(`[${operationId}] User cancelled operation`);
        tokenSource.cancel(); // Signal cancellation to file operations
        // No need to throw here, let the flow continue to finally block
      });
      const options: ProcessingOptions = {
        ...DEFAULT_CHUNK_OPTIONS,
        cancelToken: tokenSource.token,
      };

      // --- Panel Setup ---
      logger.info(
        `[${operationId}] Attempting to resolve WebviewPanelProvider`,
      );
      const webviewPanelService = container.resolve<WebviewPanelProvider>(
        'webviewPanelService',
      );
      logger.info(
        `[${operationId}] Resolved WebviewPanelProvider. Getting/Creating panel.`,
      );
      panel = webviewPanelService.getOrCreateWebviewPanel(context, container);
      logger.info(`[${operationId}] Panel obtained.`);
      messageManager.setWebviewPanel(panel);

      // --- Initial Communication (Non-blocking) ---
      try {
        progress.report({ message: 'Initializing UI...', increment: 5 });
        logger.info(`[${operationId}] Sending processingStarted message...`);
        await messageManager.executeWithRetry(async () => {
          await messageManager.sendMessage(
            {
              command: 'processingStarted', // New message type
              isRoot,
              mode: isRoot ? 'root' : 'directory',
              loading: true,
            },
            true, // Requires acknowledgment
            60000, // Longer timeout for initial handshake (60s) to handle test environments
          );
        });
        processingStartedAcknowledged = true; // Mark initial ack received
        logger.info(
          `[${operationId}] processingStarted acknowledged by webview.`,
        );
      } catch (commError) {
        logger.error(
          `[${operationId}] Failed initial communication with webview:`,
          { error: commError },
        );
        // If initial communication fails, we can't proceed
        throw new Error(
          `Failed to initialize webview communication: ${commError instanceof Error ? commError.message : String(commError)}`,
        );
      }

      if (token.isCancellationRequested) {
        throw new Error('Operation cancelled');
      }

      // --- Start Long Operations (Asynchronously) ---
      progress.report({ message: 'Scanning files... ', increment: 10 });
      logger.info(
        `[${operationId}] Starting file operations asynchronously...`,
      );

      // Calculate timeout based on file count *before* starting long ops
      let timeoutMs = messageManager.calculateTimeout(0); // Use public method with 0 files for base timeout
      try {
        const fileCount = await fileService.countFiles(directoryPath, options);
        timeoutMs = messageManager.calculateTimeout(fileCount); // Recalculate with actual count
        logger.info(
          `[${operationId}] Calculated timeout ${timeoutMs}ms based on ${fileCount} files`,
        );
      } catch (countError) {
        logger.warn(
          `[${operationId}] Could not count files to calculate timeout, using base timeout.`,
          { error: countError },
        );
        // Proceed with base timeout calculated above
      }

      // Start operations without awaiting the final result here
      const fileTreePromise = fileService
        .generateFileTree(directoryPath, rootPath, includeDotFolders, options)
        .catch((err) => {
          // Add individual catch handlers
          logger.error(`[${operationId}] Error generating file tree:`, {
            error: err,
          });
          throw err; // Re-throw to be caught by Promise.all
        });

      const combinedContentPromise = fileService
        .combineFiles(rootPath, directoryPath, includeDotFolders, options)
        .catch((err) => {
          logger.error(`[${operationId}] Error combining files:`, {
            error: err,
          });
          throw err; // Re-throw to be caught by Promise.all
        });

      // --- Wait for Long Operations ---
      // Use Promise.allSettled to wait for both, even if one fails
      logger.info(`[${operationId}] Awaiting file operations completion...`);
      const results = await Promise.allSettled([
        fileTreePromise,
        combinedContentPromise,
      ]);
      logger.info(`[${operationId}] File operations settled.`);

      if (token.isCancellationRequested) {
        throw new Error('Operation cancelled');
      }

      // Process results
      let fileTree = '';
      let combinedContent = '';
      let fileOpError: Error | undefined = undefined;

      if (results[0].status === 'fulfilled') {
        fileTree = results[0].value;
        logger.info(
          `[${operationId}] File tree generation succeeded. Size: ${fileTree.length} chars`,
        );
      } else {
        logger.error(`[${operationId}] File tree generation failed.`);
        fileOpError =
          results[0].reason instanceof Error
            ? results[0].reason
            : new Error(String(results[0].reason));
      }

      progress.report({ message: 'Processing content...', increment: 50 });

      if (results[1].status === 'fulfilled') {
        combinedContent = results[1].value;
        logger.info(
          `[${operationId}] File combining succeeded. Content size: ${combinedContent.length} chars`,
        );
      } else {
        logger.error(`[${operationId}] File combining failed.`);
        // Capture the first error encountered
        if (!fileOpError) {
          fileOpError =
            results[1].reason instanceof Error
              ? results[1].reason
              : new Error(String(results[1].reason));
        }
      }

      // If any file operation failed, throw the error to be handled by the outer catch
      if (fileOpError) {
        throw fileOpError;
      }

      // --- Final Communication ---
      progress.report({ message: 'Sending content to UI...', increment: 80 });
      logger.info(`[${operationId}] Posting final updateContent message...`);

      // Check panel validity again before final message
      if (!panel || panel.webview === undefined) {
        logger.error(
          `[${operationId}] Panel became unavailable before sending final content.`,
        );
        throw new Error('Webview became unavailable');
      }

      await messageManager.executeWithRetry(async () => {
        await messageManager.sendMessage(
          {
            command: 'updateContent', // Send final content
            fileTree, // Send generated tree (even if empty on error previously, though we throw now)
            combinedContent, // Send combined content
            isRoot,
            mode: isRoot ? 'root' : 'directory',
            loading: false, // Mark loading as complete
            // No operationId needed here unless webview needs it for specific UI logic
          },
          true, // Requires final acknowledgment
          timeoutMs, // Use calculated timeout
        );
      });

      logger.info(
        `[${operationId}] Final updateContent message acknowledged by webview.`,
      );

      progress.report({ message: 'Complete', increment: 100 });
      return true; // Indicate success
    },
    // Note: The outer try/catch/finally handles errors from the progress scope
  );

  try {
    // Wait for the progress operation to complete
    await progressPromise;
    logger.info(
      `[${operationId}] Successfully completed generateMarkdown operation`,
    );
  } catch (error) {
    logger.error(`[${operationId}] Operation failed:`, { error });

    // Send error to webview only if initial handshake succeeded
    if (panel && processingStartedAcknowledged) {
      try {
        // Don't await error message, just fire and forget
        messageManager
          .sendMessage(
            {
              command: 'showError',
              error:
                error instanceof Error
                  ? error.message
                  : 'Unknown error generating context',
            },
            false, // No acknowledgment needed for error
          )
          .catch((postError) => {
            logger.error(
              `[${operationId}] Failed attempt to send error to webview:`,
              { postError },
            );
          });
      } catch (postError) {
        // Catch synchronous errors from sendMessage itself
        logger.error(
          `[${operationId}] Synchronous error sending error to webview:`,
          {
            postError,
          },
        );
      }
    }

    handleGenerateMarkdownError(error); // Show VS Code error message
  } finally {
    logger.info(`[${operationId}] generateMarkdown finally block executing.`);
    // Clean up resources
    messageManager.cleanupPendingOperations();
    // No need to clear panel here, it's handled by WebviewPanelService disposal logic
    logger.info(`[${operationId}] generateMarkdown function exiting.`);
  }
}

function handleGenerateMarkdownError(error: unknown): void {
  // Check if it's a user cancellation error
  if (error instanceof Error && error.message.includes('cancel')) {
    logger.info('Operation was cancelled by the user, no error message shown.');
    return; // Don't show error message for cancellations
  }

  logger.error('Error during generateMarkdown:', { error });
  if (error instanceof Error) {
    vscode.window.showErrorMessage(
      `Failed to generate markdown: ${error.message}`,
    );
  } else {
    vscode.window.showErrorMessage(
      'Failed to generate markdown: Unknown error',
    );
  }
}
