import * as vscode from 'vscode';
import { logger } from '../../shared/logger';
import { FileService } from './fileService';
import { ContainerBase } from '../../di/container-base';
import { WebviewPanelProvider } from '../../di/types';
import { ProcessingOptions } from './queueService';

const DEFAULT_CHUNK_OPTIONS: ProcessingOptions = {
  chunkSize: 50,
  delayBetweenChunks: 10,
};

export async function generateMarkdown(
  rootPath: string,
  directoryPath: string,
  context: vscode.ExtensionContext,
  includeDotFolders: boolean,
  isRoot: boolean,
  fileService: FileService,
  container: ContainerBase,
): Promise<void> {
  logger.info('Entering generateMarkdown function', {
    rootPath,
    directoryPath,
    includeDotFolders,
    isRoot,
  });

  try {
    const webviewPanelService = container.resolve<WebviewPanelProvider>(
      'webviewPanelService',
    );
    const panel = webviewPanelService.getOrCreateWebviewPanel(
      context,
      container,
    );

    // Create cancellation token
    const tokenSource = new vscode.CancellationTokenSource();
    const options: ProcessingOptions = {
      ...DEFAULT_CHUNK_OPTIONS,
      cancelToken: tokenSource.token,
    };

    // Start with file tree generation
    const fileTree = await fileService.generateFileTree(
      directoryPath,
      rootPath,
      includeDotFolders,
      options,
    );

    // Update UI with file tree first
    panel.webview.postMessage({
      command: 'updateFileTree',
      fileTree,
      isRoot,
      mode: isRoot ? 'root' : 'directory',
    });

    // Then process file contents
    const combinedContent = await fileService.combineFiles(
      rootPath,
      directoryPath,
      includeDotFolders,
      options,
    );

    // Final update with all content
    panel.webview.postMessage({
      command: 'updateContent',
      fileTree,
      combinedContent,
      isRoot,
      mode: isRoot ? 'root' : 'directory',
    });
  } catch (error) {
    handleGenerateMarkdownError(error);
  }
}

function handleGenerateMarkdownError(error: unknown): void {
  logger.error('Error in generateMarkdown:', { error });
  if (error instanceof Error) {
    vscode.window.showErrorMessage(
      `Failed to generate markdown: ${error.message}`,
    );
  } else {
    vscode.window.showErrorMessage('Failed to generate markdown');
  }
}
