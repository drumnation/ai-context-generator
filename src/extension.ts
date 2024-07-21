import * as vscode from 'vscode';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext) {
    console.log('AI-PACK EXTENSION IS NOW ACTIVE!');
    registerCommands(context);
}

export function deactivate() {}
