// import * as vscode from 'vscode';
// import { setupHotReload } from './hotReload';
// import path from 'path';

// let currentPanel: vscode.WebviewPanel | undefined = undefined;

// export function createWebviewPanel(
//   context: vscode.ExtensionContext,
// ): vscode.WebviewPanel {
//   if (!currentPanel) {
//     currentPanel = vscode.window.createWebviewPanel(
//       'helloReact',
//       'Hello React!',
//       vscode.ViewColumn.One,
//       {
//         enableScripts: true,
//         retainContextWhenHidden: true,
//       },
//     );

//     setupMessageHandler(currentPanel, context);
//     setupPanelCleanup();
//     setupHotReload(context, currentPanel);
//   }
//   return currentPanel;
// }

// function setupMessageHandler(
//   panel: vscode.WebviewPanel,
//   context: vscode.ExtensionContext,
// ) {
//   panel.webview.onDidReceiveMessage(
//     (message) => {
//       switch (message.command) {
//         case 'showMessage':
//           vscode.window.showInformationMessage(message.text);
//           return;
//       }
//     },
//     undefined,
//     context.subscriptions,
//   );
// }

// function setupPanelCleanup() {
//   currentPanel!.onDidDispose(() => {
//     currentPanel = undefined;
//   });
// }

// export function getWebviewPanel(): vscode.WebviewPanel | undefined {
//   return currentPanel;
// }

// export function getWebviewContent(
//   context: vscode.ExtensionContext,
//   toolkitUri: vscode.Uri,
//   codiconsUri: vscode.Uri,
// ) {
//   const scriptUri = vscode.Uri.file(
//     path.join(context.extensionPath, 'dist', 'webview.js'),
//   ).with({ scheme: 'vscode-resource' });

//   return `
//     <!DOCTYPE html>
//     <html lang="en">
//     <head>
//         <meta charset="UTF-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <title>AI-Pack Webview</title>
//         <link href="${codiconsUri}" rel="stylesheet" />
//         <script type="module" src="${toolkitUri}"></script>
//     </head>
//     <body>
//         <div id="root"></div>
//         <script src="${scriptUri}"></script>
//     </body>
//     </html>`;
// }
