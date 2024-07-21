import * as vscode from 'vscode';
import * as path from 'path';
import { generateFileTree, combineFiles } from './utils';
import { getWebviewContent } from './webviewManager';

export async function generateMarkdown(rootPath: string, directoryPath: string, context: vscode.ExtensionContext, includeDotFolders: boolean, isRoot: boolean) {
    console.log('Entering generateMarkdown function');
    try {
        const panel = vscode.window.createWebviewPanel(
            'markdownPreview',
            `AI-Context for ./${path.relative(rootPath, directoryPath)}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'node_modules', '@vscode')), vscode.Uri.file(path.join(context.extensionPath, 'out'))]
            }
        );
        console.log('Webview panel created');

        const toolkitUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js'));
        const codiconsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'));

        console.log(`Toolkit URI: ${toolkitUri}`);
        console.log(`Codicons URI: ${codiconsUri}`);

        panel.webview.html = getWebviewContent(toolkitUri, codiconsUri, isRoot);
        console.log('Webview HTML set');

        let showRootFiletree = false;
        let showRootCombined = false;
        let fileSelections: { [key: string]: boolean } = {};

        let fileTreeCache = '';
        let combinedContentCache = '';
        let rootFileTreeCache = '';
        let rootCombinedContentCache = '';

        let initialLoad = true;

        const timeoutId = setTimeout(() => {
            panel.webview.postMessage({ command: 'showError' });
        }, 30000);

        async function renderContent() {
            console.log('Entering renderContent function');
            try {
                if (!fileTreeCache) {
                    console.log('Generating file tree');
                    fileTreeCache = await generateFileTree(directoryPath, rootPath, includeDotFolders);
                }

                if (!combinedContentCache) {
                    console.log('Combining files');
                    combinedContentCache = await combineFiles(rootPath, directoryPath, includeDotFolders);
                }

                if (!rootFileTreeCache && !isRoot) {
                    console.log('Generating root file tree');
                    rootFileTreeCache = await generateFileTree(rootPath, rootPath, includeDotFolders);
                }

                if (!rootCombinedContentCache && !isRoot) {
                    console.log('Combining root files');
                    rootCombinedContentCache = await combineFiles(rootPath, rootPath, includeDotFolders);
                }

                const fileTree = showRootFiletree ? rootFileTreeCache + '\n\n' + fileTreeCache : fileTreeCache;
                const combinedContent = showRootCombined ? rootCombinedContentCache + '\n\n' + combinedContentCache : combinedContentCache;

                const filteredCombinedContent = combinedContent.split('\n\n').filter(section => {
                    const fileHeader = section.match(/# \.\/(.+)\n/);
                    if (!fileHeader) {return true;}
                    const filePath = fileHeader[1];
                    return fileSelections[filePath] !== false;
                }).join('\n\n');

                console.log('Sending content to webview');
                clearTimeout(timeoutId);
                if (!fileTree && !filteredCombinedContent) {
                    panel.webview.postMessage({ command: 'showError' });
                } else {
                    panel.webview.postMessage({
                        command: 'updateContent',
                        fileTree: fileTree,
                        combinedContent: filteredCombinedContent,
                        isRoot: isRoot
                    });
                }
            } catch (error) {
                console.error('Error in renderContent:', error);
                vscode.window.showErrorMessage(`Error generating AI context: ${error instanceof Error ? error.message : String(error)}`);
                clearTimeout(timeoutId);
            }
        }

        panel.webview.onDidReceiveMessage(
            message => {
                console.log('Received message from webview:', message);
                switch (message.command) {
                    case 'copyToClipboard':
                        vscode.env.clipboard.writeText(message.content);
                        vscode.window.showInformationMessage('Content copied to clipboard');
                        break;
                    case 'toggleRootFiletree':
                        showRootFiletree = message.checked;
                        renderContent();
                        break;
                    case 'toggleRootCombined':
                        showRootCombined = message.checked;
                        renderContent();
                        break;
                    case 'toggleFiles':
                        document.querySelectorAll('.file-checkbox input').forEach((element) => {
                            const checkbox = element as HTMLInputElement;
                            checkbox.checked = message.checked;
                            const label = checkbox.nextSibling as HTMLLabelElement | null;
                            if (label) {
                                fileSelections[label.textContent || ''] = message.checked;
                            }
                        });
                        renderContent();
                        break;
                    case 'fileSelectionChanged':
                        fileSelections = message.selections as { [key: string]: boolean };
                        renderContent();
                        break;
                    case 'webviewLoaded':
                        console.log('Webview has loaded');
                        if (!initialLoad) {
                            initialLoad = true;
                            vscode.window.showInformationMessage('AI-Pack webview loaded successfully');
                        }
                        break;
                    case 'renderContent':
                        renderContent();
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        // Initial render
        await renderContent();

    } catch (error) {
        console.error('Error in generateMarkdown:', error);
        vscode.window.showErrorMessage(`Error generating AI context: ${error instanceof Error ? error.message : String(error)}`);
    }
}
