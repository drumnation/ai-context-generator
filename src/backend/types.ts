import * as vscode from 'vscode';
import { Container } from '../di/container';

export interface WebviewPanelProvider {
  getOrCreateWebviewPanel(
    context: vscode.ExtensionContext,
    container: Container,
  ): vscode.WebviewPanel;
}

export interface WebviewMessage {
  command: string;
  content?: string;
  checked?: boolean;
  selections?: { [key: string]: boolean };
  mode?: 'root' | 'directory';
  fileTree?: string;
  combinedContent?: string;
  isRoot?: boolean;
  error?: string;
  componentStack?: string;
  text?: string;
  [key: string]: unknown;
}

export interface CachedContent {
  fileTreeCache: string;
  combinedContentCache: string;
  rootFileTreeCache: string;
  rootCombinedContentCache: string;
  showRootFiletree: boolean;
  showRootCombined: boolean;
  fileSelections: { [key: string]: boolean };
}
