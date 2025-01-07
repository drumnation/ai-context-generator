import * as vscode from 'vscode';
import { CachedContent, WebviewMessage } from '../types';

async function handleCopyToClipboard(
  content: string | undefined,
): Promise<void> {
  if (content) {
    await vscode.env.clipboard.writeText(content);
    vscode.window.showInformationMessage('Content copied to clipboard');
  }
}

export { handleCopyToClipboard };
