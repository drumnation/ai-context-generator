/* eslint-disable no-case-declarations */
import * as vscode from 'vscode';
import { logger } from '../../shared/logger';
import { FileService } from './fileService';
import { Container } from '../../di/container';
import { CachedContent, WebviewMessage } from '../types';
import { setupMessageHandler } from '../commands';
import { setupHotReload } from '../utils/hotReload';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export async function generateMarkdown(
  rootPath: string,
  directoryPath: string,
  context: vscode.ExtensionContext,
  includeDotFolders: boolean,
  isRoot: boolean,
  fileService: FileService,
): Promise<void> {
  logger.info('Entering generateMarkdown function', {
    rootPath,
    directoryPath,
    isRoot,
  });
  try {
    const panel = await getOrCreateWebviewPanel(context, new Container());
    const content = await getCachedContent(
      directoryPath,
      rootPath,
      includeDotFolders,
      isRoot,
      fileService,
    );
    await sendContentToWebview(panel, content, isRoot);
    setupMessageHandlers(panel, context, content, isRoot);
  } catch (error) {
    handleGenerateMarkdownError(error);
  }
}

async function getOrCreateWebviewPanel(
  context: vscode.ExtensionContext,
  container: Container,
): Promise<vscode.WebviewPanel> {
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

async function getCachedContent(
  directoryPath: string,
  rootPath: string,
  includeDotFolders: boolean,
  isRoot: boolean,
  fileService: FileService,
): Promise<CachedContent> {
  logger.info('Generating cached content', {
    directoryPath,
    rootPath,
    includeDotFolders,
    isRoot,
  });
  const fileTreeCache = await fileService.generateFileTree(
    directoryPath,
    rootPath,
    includeDotFolders,
  );
  const combinedContentCache = await fileService.combineFiles(
    rootPath,
    directoryPath,
    includeDotFolders,
  );

  const rootFileTreeCache = isRoot
    ? ''
    : await fileService.generateFileTree(rootPath, rootPath, includeDotFolders);
  const rootCombinedContentCache = isRoot
    ? ''
    : await fileService.combineFiles(rootPath, rootPath, includeDotFolders);

  return {
    fileTreeCache,
    combinedContentCache,
    rootFileTreeCache,
    rootCombinedContentCache,
    showRootFiletree: false,
    showRootCombined: false,
    fileSelections: {},
  };
}

async function sendContentToWebview(
  panel: vscode.WebviewPanel,
  content: CachedContent,
  isRoot: boolean,
): Promise<void> {
  logger.info('Sending content to webview', { isRoot });
  panel.webview.postMessage({
    command: 'updateContent',
    fileTree: content.fileTreeCache,
    combinedContent: content.combinedContentCache,
    isRoot: isRoot,
    mode: isRoot ? 'root' : 'directory',
  });
}

function setupMessageHandlers(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  content: CachedContent,
  isRoot: boolean,
): void {
  logger.info('Setting up message handlers');
  const timeoutId = setTimeout(
    () => panel.webview.postMessage({ command: 'showError' }),
    30000,
  );

  panel.webview.onDidReceiveMessage(
    async (message: WebviewMessage) => {
      logger.info('Received message from webview', message);
      await handleWebviewMessage(message, content, panel, timeoutId, isRoot);
    },
    undefined,
    context.subscriptions,
  );
}

async function handleWebviewMessage(
  message: WebviewMessage,
  content: CachedContent,
  panel: vscode.WebviewPanel,
  timeoutId: NodeJS.Timeout,
  isRoot: boolean,
): Promise<void> {
  switch (message.command) {
    case 'copyToClipboard':
      await handleCopyToClipboard(message.content);
      break;
    case 'toggleRootFiletree':
      await handleToggleRootFiletree(
        message.checked,
        content,
        panel,
        timeoutId,
        isRoot,
      );
      break;
    case 'toggleRootCombined':
      await handleToggleRootCombined(
        message.checked,
        content,
        panel,
        timeoutId,
        isRoot,
      );
      break;
    case 'toggleFiles':
      await handleToggleFiles(
        message.checked,
        content,
        panel,
        timeoutId,
        isRoot,
      );
      break;
    case 'fileSelectionChanged':
      await handleFileSelectionChanged(
        message.selections,
        content,
        panel,
        timeoutId,
        isRoot,
      );
      break;
    case 'changeMode':
      await handleChangeMode(message.mode, content, panel, timeoutId, isRoot);
      break;
    case 'webviewLoaded':
      handleWebviewLoaded();
      break;
    case 'renderContent':
      await renderContent(panel, content, timeoutId, isRoot);
      break;
    default:
      logger.warn('Unknown message command', message);
  }
}

async function handleCopyToClipboard(
  content: string | undefined,
): Promise<void> {
  if (content) {
    await vscode.env.clipboard.writeText(content);
    vscode.window.showInformationMessage('Content copied to clipboard');
  }
}

async function handleToggleRootFiletree(
  checked: boolean | undefined,
  content: CachedContent,
  panel: vscode.WebviewPanel,
  timeoutId: NodeJS.Timeout,
  isRoot: boolean,
): Promise<void> {
  if (checked !== undefined) {
    content.showRootFiletree = checked;
    await renderContent(panel, content, timeoutId, isRoot);
  }
}

async function handleToggleRootCombined(
  checked: boolean | undefined,
  content: CachedContent,
  panel: vscode.WebviewPanel,
  timeoutId: NodeJS.Timeout,
  isRoot: boolean,
): Promise<void> {
  if (checked !== undefined) {
    content.showRootCombined = checked;
    await renderContent(panel, content, timeoutId, isRoot);
  }
}

async function handleToggleFiles(
  checked: boolean | undefined,
  content: CachedContent,
  panel: vscode.WebviewPanel,
  timeoutId: NodeJS.Timeout,
  isRoot: boolean,
): Promise<void> {
  if (checked !== undefined) {
    content.fileSelections = Object.fromEntries(
      Object.entries(content.fileSelections).map(([key]) => [key, checked]),
    );
    await renderContent(panel, content, timeoutId, isRoot);
  }
}

async function handleFileSelectionChanged(
  selections: { [key: string]: boolean } | undefined,
  content: CachedContent,
  panel: vscode.WebviewPanel,
  timeoutId: NodeJS.Timeout,
  isRoot: boolean,
): Promise<void> {
  if (selections) {
    content.fileSelections = selections;
    await renderContent(panel, content, timeoutId, isRoot);
  }
}

async function handleChangeMode(
  mode: 'root' | 'directory' | undefined,
  content: CachedContent,
  panel: vscode.WebviewPanel,
  timeoutId: NodeJS.Timeout,
  isRoot: boolean,
): Promise<void> {
  if (mode) {
    if (mode === 'root') {
      content.showRootFiletree = true;
      content.showRootCombined = true;
    } else {
      content.showRootFiletree = false;
      content.showRootCombined = false;
    }
    await renderContent(panel, content, timeoutId, isRoot);
  }
}

function handleWebviewLoaded(): void {
  logger.info('Webview has loaded');
  vscode.window.showInformationMessage('AI-Pack webview loaded successfully');
}

async function renderContent(
  panel: vscode.WebviewPanel,
  content: CachedContent,
  timeoutId: NodeJS.Timeout,
  isRoot: boolean,
): Promise<void> {
  logger.info('Rendering content', { isRoot });
  try {
    const fileTree = getFileTree(content);
    const combinedContent = getCombinedContent(content);
    const filteredCombinedContent = filterCombinedContent(
      combinedContent,
      content.fileSelections,
    );

    clearTimeout(timeoutId);
    if (!fileTree && !filteredCombinedContent) {
      panel.webview.postMessage({ command: 'showError' });
    } else {
      panel.webview.postMessage({
        command: 'updateContent',
        fileTree: fileTree,
        combinedContent: filteredCombinedContent,
        isRoot: isRoot,
      });
    }
  } catch (error) {
    handleRenderContentError(error);
    clearTimeout(timeoutId);
  }
}

function getFileTree(content: CachedContent): string {
  return content.showRootFiletree
    ? content.rootFileTreeCache + '\n\n' + content.fileTreeCache
    : content.fileTreeCache;
}

function getCombinedContent(content: CachedContent): string {
  return content.showRootCombined
    ? content.rootCombinedContentCache + '\n\n' + content.combinedContentCache
    : content.combinedContentCache;
}

function filterCombinedContent(
  combinedContent: string,
  fileSelections: { [key: string]: boolean },
): string {
  return combinedContent
    .split('\n\n')
    .filter((section) => {
      const fileHeader = section.match(/# \.\/(.+)\n/);
      if (!fileHeader) {
        return true;
      }
      const filePath = fileHeader[1];
      return fileSelections[filePath] !== false;
    })
    .join('\n\n');
}

function handleGenerateMarkdownError(error: unknown): void {
  logger.error('Error in generateMarkdown', error);
  vscode.window.showErrorMessage(
    `Error generating AI context: ${error instanceof Error ? error.message : String(error)}`,
  );
}

function handleRenderContentError(error: unknown): void {
  logger.error('Error in renderContent', error);
  vscode.window.showErrorMessage(
    `Error generating AI context: ${error instanceof Error ? error.message : String(error)}`,
  );
}
