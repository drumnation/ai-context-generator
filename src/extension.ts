import * as vscode from 'vscode';
import { registerCommands, getContainer } from './backend/commands';

export function activate(context: vscode.ExtensionContext) {
  console.log('AI-PACK EXTENSION IS NOW ACTIVE!');
  const container = getContainer();
  context.extension.exports.container = container;
  registerCommands(context, container);
}

export function deactivate() {}
