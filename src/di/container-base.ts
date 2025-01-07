import * as vscode from 'vscode';

export interface ContainerBase {
  register<T>(name: string, service: T): void;
  resolve<T>(name: string): T;
  context: vscode.ExtensionContext;
}
