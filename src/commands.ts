import * as vscode from 'vscode';
import { generateMarkdown } from './markdownGenerator';
import path from 'path';
import { setupHotReload } from './setup/hotReload';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function createWebviewPanel(
  context: vscode.ExtensionContext,
): vscode.WebviewPanel {
  if (!currentPanel) {
    currentPanel = vscode.window.createWebviewPanel(
      'aiContext',
      'AI-Context',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    setupMessageHandler(currentPanel, context);
    setupPanelCleanup();
    setupHotReload(context, currentPanel);
  }
  return currentPanel;
}

function setupMessageHandler(
  panel: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
) {
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'showMessage':
          vscode.window.showInformationMessage(message.text);
          return;
        case 'changeMode':
          // eslint-disable-next-line no-case-declarations
          const rootPath = vscode.workspace.workspaceFolders
            ? vscode.workspace.workspaceFolders[0].uri.fsPath
            : '';
          if (message.mode === 'root') {
            await generateMarkdown(rootPath, rootPath, context, false, true);
          } else {
            // Assuming we're switching back to the last selected directory
            // You might need to store the last selected directory somewhere
            const lastSelectedDir = rootPath; // Replace with actual last selected directory
            await generateMarkdown(
              rootPath,
              lastSelectedDir,
              context,
              false,
              false,
            );
          }
          return;
      }
    },
    undefined,
    context.subscriptions,
  );
}

function setupPanelCleanup() {
  currentPanel!.onDidDispose(() => {
    currentPanel = undefined;
  });
}

export function getWebviewPanel(): vscode.WebviewPanel | undefined {
  return currentPanel;
}

export function registerCommands(context: vscode.ExtensionContext) {
  const generateMarkdownDisposable = vscode.commands.registerCommand(
    'ai-pack.generateMarkdown',
    async (uri: vscode.Uri) => {
      console.log('generateMarkdown command triggered');
      if (uri && uri.scheme === 'file') {
        const directoryPath = uri.fsPath;
        const rootPath = vscode.workspace.workspaceFolders
          ? vscode.workspace.workspaceFolders[0].uri.fsPath
          : '';
        const includeDotFolders = path.basename(directoryPath).startsWith('.');
        console.log(`Generating markdown for directory: ${directoryPath}`);

        const panel = createWebviewPanel(context);

        await generateMarkdown(
          rootPath,
          directoryPath,
          context,
          includeDotFolders,
          false,
        );

        panel.webview.postMessage({
          command: 'updateMarkdown',
          data: {
            /* markdown data */
          },
        });
      } else {
        console.log('Invalid URI or not a file scheme');
        vscode.window.showInformationMessage(
          'Please right-click on a folder to use this command.',
        );
      }
    },
  );

  const generateMarkdownRootDisposable = vscode.commands.registerCommand(
    'ai-pack.generateMarkdownRoot',
    async () => {
      console.log('generateMarkdownRoot command triggered');
      if (vscode.workspace.workspaceFolders) {
        const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        console.log(`Generating markdown for root: ${rootPath}`);

        const panel = createWebviewPanel(context);

        await generateMarkdown(rootPath, rootPath, context, false, true);

        panel.webview.postMessage({
          command: 'updateMarkdown',
          data: {
            /* markdown data */
          },
        });
      } else {
        console.log('No workspace folder is open');
        vscode.window.showInformationMessage('No workspace folder is open.');
      }
    },
  );

  context.subscriptions.push(
    generateMarkdownDisposable,
    generateMarkdownRootDisposable,
  );
}

export function activate(context: vscode.ExtensionContext) {
  console.log('AI-PACK EXTENSION IS NOW ACTIVE!');
  registerCommands(context);
}

export function deactivate() {}
