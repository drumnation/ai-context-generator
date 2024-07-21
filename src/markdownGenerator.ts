import * as vscode from 'vscode';
import * as path from 'path';
import { generateFileTree, combineFiles } from './utils';
import { getWebviewContent } from './webviewManager';

interface CachedContent {
    fileTreeCache: string;
    combinedContentCache: string;
    rootFileTreeCache: string;
    rootCombinedContentCache: string;
    showRootFiletree: boolean;
    showRootCombined: boolean;
    fileSelections: { [key: string]: boolean };
}

async function createWebviewPanel(context: vscode.ExtensionContext, rootPath: string, directoryPath: string, isRoot: boolean) {
    const panel = vscode.window.createWebviewPanel(
        'markdownPreview',
        `AI-Context for ./${path.relative(rootPath, directoryPath)}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'node_modules', '@vscode')), vscode.Uri.file(path.join(context.extensionPath, 'out'))]
        }
    );
    
    const toolkitUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js'));
    const codiconsUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'));

    panel.webview.html = getWebviewContent(toolkitUri, codiconsUri, isRoot);
    return panel;
}

async function getCachedContent(directoryPath: string, rootPath: string, includeDotFolders: boolean, isRoot: boolean): Promise<CachedContent> {
    const fileTreeCache = await generateFileTree(directoryPath, rootPath, includeDotFolders);
    const combinedContentCache = await combineFiles(rootPath, directoryPath, includeDotFolders);

    const rootFileTreeCache = isRoot ? '' : await generateFileTree(rootPath, rootPath, includeDotFolders);
    const rootCombinedContentCache = isRoot ? '' : await combineFiles(rootPath, rootPath, includeDotFolders);

    return { 
        fileTreeCache, 
        combinedContentCache, 
        rootFileTreeCache, 
        rootCombinedContentCache,
        showRootFiletree: false,
        showRootCombined: false,
        fileSelections: {}
    };
}

function filterCombinedContent(combinedContent: string, fileSelections: { [key: string]: boolean }) {
    return combinedContent.split('\n\n').filter(section => {
        const fileHeader = section.match(/# \.\/(.+)\n/);
        if (!fileHeader) { return true; }
        const filePath = fileHeader[1];
        return fileSelections[filePath] !== false;
    }).join('\n\n');
}

async function renderContent(panel: vscode.WebviewPanel, content: CachedContent, timeoutId: NodeJS.Timeout, isRoot: boolean) {
    try {
        const fileTree = content.showRootFiletree ? content.rootFileTreeCache + '\n\n' + content.fileTreeCache : content.fileTreeCache;
        const combinedContent = content.showRootCombined ? content.rootCombinedContentCache + '\n\n' + content.combinedContentCache : content.combinedContentCache;

        const filteredCombinedContent = filterCombinedContent(combinedContent, content.fileSelections);

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

export async function generateMarkdown(rootPath: string, directoryPath: string, context: vscode.ExtensionContext, includeDotFolders: boolean, isRoot: boolean) {
    console.log('Entering generateMarkdown function');
    try {
        const panel = await createWebviewPanel(context, rootPath, directoryPath, isRoot);
        console.log('Webview panel created');

        let initialLoad = true;

        const timeoutId = setTimeout(() => {
            panel.webview.postMessage({ command: 'showError' });
        }, 30000);

        const content = await getCachedContent(directoryPath, rootPath, includeDotFolders, isRoot);

        panel.webview.onDidReceiveMessage(
            async message => {
                console.log('Received message from webview:', message);
                switch (message.command) {
                    case 'copyToClipboard':
                        vscode.env.clipboard.writeText(message.content);
                        vscode.window.showInformationMessage('Content copied to clipboard');
                        break;
                    case 'toggleRootFiletree':
                        content.showRootFiletree = message.checked;
                        await renderContent(panel, content, timeoutId, isRoot);
                        break;
                    case 'toggleRootCombined':
                        content.showRootCombined = message.checked;
                        await renderContent(panel, content, timeoutId, isRoot);
                        break;
                    case 'toggleFiles':
                        document.querySelectorAll('.file-checkbox input').forEach((element) => {
                            const checkbox = element as HTMLInputElement;
                            checkbox.checked = message.checked;
                            const label = checkbox.nextSibling as HTMLLabelElement | null;
                            if (label) {
                                content.fileSelections[label.textContent || ''] = message.checked;
                            }
                        });
                        await renderContent(panel, content, timeoutId, isRoot);
                        break;
                    case 'fileSelectionChanged':
                        content.fileSelections = message.selections as { [key: string]: boolean };
                        await renderContent(panel, content, timeoutId, isRoot);
                        break;
                    case 'webviewLoaded':
                        console.log('Webview has loaded');
                        if (initialLoad) {
                            initialLoad = false;
                            vscode.window.showInformationMessage('AI-Pack webview loaded successfully');
                        }
                        break;
                    case 'renderContent':
                        await renderContent(panel, content, timeoutId, isRoot);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        // Initial render
        await renderContent(panel, content, timeoutId, isRoot);

    } catch (error) {
        console.error('Error in generateMarkdown:', error);
        vscode.window.showErrorMessage(`Error generating AI context: ${error instanceof Error ? error.message : String(error)}`);
    }
}
