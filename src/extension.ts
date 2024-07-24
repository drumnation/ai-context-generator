import * as vscode from 'vscode';
import { registerCommands } from './backend/commands';
import { Container } from './di/container';
import { FileService } from './backend/services/fileService';

let container: Container;

export function activate(context: vscode.ExtensionContext) {
  console.log('AI-PACK EXTENSION IS NOW ACTIVE!');

  container = new Container();
  container.register('fileService', new FileService());

  registerCommands(context, container);
}

export function deactivate() {}
