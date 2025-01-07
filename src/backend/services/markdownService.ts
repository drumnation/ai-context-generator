import * as vscode from 'vscode';

async function handleCopyToClipboard(
  content: string | undefined,
): Promise<void> {
  if (content) {
    try {
      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage('Content copied to clipboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to copy to clipboard: ${message}`);
    }
  }
}

export { handleCopyToClipboard };
