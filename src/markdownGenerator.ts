import * as vscode from 'vscode';
import { generateFileTree, combineFiles } from './utils';
import { createWebviewPanel } from './commands';

interface CachedContent {
  fileTreeCache: string;
  combinedContentCache: string;
  rootFileTreeCache: string;
  rootCombinedContentCache: string;
  showRootFiletree: boolean;
  showRootCombined: boolean;
  fileSelections: { [key: string]: boolean };
}

async function getCachedContent(
  directoryPath: string,
  rootPath: string,
  includeDotFolders: boolean,
  isRoot: boolean,
): Promise<CachedContent> {
  const fileTreeCache = await generateFileTree(
    directoryPath,
    rootPath,
    includeDotFolders,
  );
  const combinedContentCache = await combineFiles(
    rootPath,
    directoryPath,
    includeDotFolders,
  );

  const rootFileTreeCache = isRoot
    ? ''
    : await generateFileTree(rootPath, rootPath, includeDotFolders);
  const rootCombinedContentCache = isRoot
    ? ''
    : await combineFiles(rootPath, rootPath, includeDotFolders);

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

function filterCombinedContent(
  combinedContent: string,
  fileSelections: { [key: string]: boolean },
) {
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

async function renderContent(
  panel: vscode.WebviewPanel,
  content: CachedContent,
  timeoutId: NodeJS.Timeout,
  isRoot: boolean,
) {
  try {
    const fileTree = content.showRootFiletree
      ? content.rootFileTreeCache + '\n\n' + content.fileTreeCache
      : content.fileTreeCache;
    const combinedContent = content.showRootCombined
      ? content.rootCombinedContentCache + '\n\n' + content.combinedContentCache
      : content.combinedContentCache;

    const filteredCombinedContent = filterCombinedContent(
      combinedContent,
      content.fileSelections,
    );

    clearTimeout(timeoutId);
    if (!fileTree && !filteredCombinedContent) {
      panel.webview.postMessage({ command: 'showError' });
    } else {
      console.log('Sending updateContent message');
      panel.webview.postMessage({
        command: 'updateContent',
        fileTree: fileTree,
        combinedContent: filteredCombinedContent,
        isRoot: isRoot,
      });
    }
  } catch (error) {
    console.error('Error in renderContent:', error);
    vscode.window.showErrorMessage(
      `Error generating AI context: ${error instanceof Error ? error.message : String(error)}`,
    );
    clearTimeout(timeoutId);
  }
}

export async function generateMarkdown(
  rootPath: string,
  directoryPath: string,
  context: vscode.ExtensionContext,
  includeDotFolders: boolean,
  isRoot: boolean,
) {
  console.log('Entering generateMarkdown function');
  try {
    const panel = createWebviewPanel(context);
    console.log('Webview panel created');

    const content = await getCachedContent(
      directoryPath,
      rootPath,
      includeDotFolders,
      isRoot,
    );

    panel.webview.postMessage({
      command: 'updateContent',
      fileTree: content.fileTreeCache,
      combinedContent: content.combinedContentCache,
      isRoot: isRoot,
      mode: isRoot ? 'root' : 'directory',
    });

    const timeoutId = setTimeout(() => {
      panel.webview.postMessage({ command: 'showError' });
    }, 30000);

    panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log('Received message from webview:', message);
        switch (message.command) {
          case 'copyToClipboard':
            vscode.env.clipboard.writeText(message.content);
            vscode.window.showInformationMessage('Content copied to clipboard');
            break;
          case 'toggleRootFiletree': {
            content.showRootFiletree = message.checked;
            await renderContent(panel, content, timeoutId, isRoot);
            break;
          }
          case 'toggleRootCombined': {
            content.showRootCombined = message.checked;
            await renderContent(panel, content, timeoutId, isRoot);
            break;
          }
          case 'toggleFiles':
            content.fileSelections = Object.fromEntries(
              Object.entries(content.fileSelections).map(([key]) => [
                key,
                message.checked,
              ]),
            );
            await renderContent(panel, content, timeoutId, isRoot);
            break;
          case 'fileSelectionChanged':
            content.fileSelections = message.selections;
            await renderContent(panel, content, timeoutId, isRoot);
            break;
          case 'changeMode':
            if (message.mode === 'root') {
              content.showRootFiletree = true;
              content.showRootCombined = true;
            } else {
              content.showRootFiletree = false;
              content.showRootCombined = false;
            }
            await renderContent(panel, content, timeoutId, isRoot);
            break;
          case 'webviewLoaded':
            console.log('Webview has loaded');
            vscode.window.showInformationMessage(
              'AI-Pack webview loaded successfully',
            );
            break;
          case 'renderContent':
            await renderContent(panel, content, timeoutId, isRoot);
            break;
        }
      },
      undefined,
      context.subscriptions,
    );

    await renderContent(panel, content, timeoutId, isRoot);
  } catch (error) {
    console.error('Error in generateMarkdown:', error);
    vscode.window.showErrorMessage(
      `Error generating AI context: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
