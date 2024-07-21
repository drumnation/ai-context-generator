import * as vscode from 'vscode';
import { generateMarkdown } from './markdownGenerator';
import path from 'path';

export function registerCommands(context: vscode.ExtensionContext) {
    const generateMarkdownDisposable = vscode.commands.registerCommand('ai-pack.generateMarkdown', async (uri: vscode.Uri) => {
        console.log('generateMarkdown command triggered');
        if (uri && uri.scheme === 'file') {
            const directoryPath = uri.fsPath;
            const rootPath = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';
            const includeDotFolders = path.basename(directoryPath).startsWith('.');
            console.log(`Generating markdown for directory: ${directoryPath}`);
            await generateMarkdown(rootPath, directoryPath, context, includeDotFolders, false);
        } else {
            console.log('Invalid URI or not a file scheme');
            vscode.window.showInformationMessage('Please right-click on a folder to use this command.');
        }
    });

    const generateMarkdownRootDisposable = vscode.commands.registerCommand('ai-pack.generateMarkdownRoot', async () => {
        console.log('generateMarkdownRoot command triggered');
        if (vscode.workspace.workspaceFolders) {
            const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            console.log(`Generating markdown for root: ${rootPath}`);
            await generateMarkdown(rootPath, rootPath, context, false, true);
        } else {
            console.log('No workspace folder is open');
            vscode.window.showInformationMessage('No workspace folder is open.');
        }
    });

    context.subscriptions.push(generateMarkdownDisposable, generateMarkdownRootDisposable);
}
