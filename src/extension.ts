import * as vscode from 'vscode';
import { registerCommands, getContainer } from './backend/commands';
import { Container } from './di/container';

let extensionContainer: Container | null = null;

export async function activate(context: vscode.ExtensionContext) {
  try {
    console.log('AI-PACK EXTENSION IS NOW ACTIVE!');

    // Initialize container
    const container = getContainer();
    if (!container) {
      throw new Error('Failed to initialize container');
    }

    // Store container for access
    extensionContainer = container;

    // Register commands
    registerCommands(context, container);

    return {
      container: extensionContainer,
      isActive: true,
    };
  } catch (error) {
    console.error('Failed to activate extension:', error);
    throw error;
  }
}

export function deactivate() {
  console.log('AI-PACK EXTENSION IS NOW DEACTIVATED!');
  extensionContainer = null;
}
