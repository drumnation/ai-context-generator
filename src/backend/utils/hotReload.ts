import * as vscode from 'vscode';
import * as path from 'path';

export function setupHotReload(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
) {
  const updateWebview = () => {
    const scriptSrc = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview.js')),
    );
    const cssSrc = panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview.css')),
    );
    const toolkitCssSrc =
      'https://unpkg.com/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.css';

    panel.webview.html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI Component Refactor</title>
            <link rel="stylesheet" href="${cssSrc}" />
            <link rel="stylesheet" href="${toolkitCssSrc}" />
        </head>
        <body>
            <div id="root"></div>
            <script src="${scriptSrc}"></script>
        </body>
        </html>`;
  };

  const reloadWebview = () => {
    vscode.commands.executeCommand(
      'workbench.action.webview.reloadWebviewAction',
    );
  };

  // Watch the dist directory for changes
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(context.extensionPath, 'dist/*'),
  );

  watcher.onDidChange(reloadWebview);
  watcher.onDidCreate(reloadWebview);
  watcher.onDidDelete(reloadWebview);

  context.subscriptions.push(watcher);

  // Initial update
  updateWebview();

  return updateWebview;
}
