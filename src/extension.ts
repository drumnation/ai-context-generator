import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export function activate(context: vscode.ExtensionContext) {
    console.log('AI-PACK EXTENSION IS NOW ACTIVE!');

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

async function generateMarkdown(rootPath: string, directoryPath: string, context: vscode.ExtensionContext, includeDotFolders: boolean, isRoot: boolean) {
    console.log('Entering generateMarkdown function');
    try {
        const panel = vscode.window.createWebviewPanel(
            'markdownPreview',
            `Generated Markdown for ${path.basename(directoryPath)}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'out'))]
            }
        );
        console.log('Webview panel created');

        const webviewPath = vscode.Uri.file(path.join(context.extensionPath, 'out', 'webview'));
        const mainScriptPathOnDisk = vscode.Uri.file(path.join(webviewPath.fsPath, 'main.js'));
        const mainScriptUri = panel.webview.asWebviewUri(mainScriptPathOnDisk);

        panel.webview.html = getWebviewContent(mainScriptUri);
        console.log('Webview HTML set:', panel.webview.html);

        let showRootFiletree = false;
        let showRootCombined = false;

        let fileTreeCache = '';
        let combinedContentCache = '';
        let rootFileTreeCache = '';
        let rootCombinedContentCache = '';

        async function renderContent() {
            console.log('Entering renderContent function');
            try {
                const progressOptions = {
                    location: vscode.ProgressLocation.Notification,
                    title: "Generating Markdown",
                    cancellable: false
                };

                await vscode.window.withProgress(progressOptions, async (progress) => {
                    progress.report({ increment: 0 });

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

                    progress.report({ increment: 100, message: "Rendering content..." });

                    const fileTree = showRootFiletree ? rootFileTreeCache + '\n\n' + fileTreeCache : fileTreeCache;
                    const combinedContent = showRootCombined ? rootCombinedContentCache + '\n\n' + combinedContentCache : combinedContentCache;

                    console.log('Sending content to webview');
                    panel.webview.postMessage({ 
                        command: 'updateContent',
                        fileTree: fileTree,
                        combinedContent: combinedContent,
                        isRoot: isRoot
                    });
                });
            } catch (error) {
                console.error('Error in renderContent:', error);
                vscode.window.showErrorMessage(`Error generating markdown: ${error instanceof Error ? error.message : String(error)}`);
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
                    case 'webviewLoaded':
                        console.log('Webview has loaded');
                        vscode.window.showInformationMessage('AI-Pack webview loaded successfully');
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
        vscode.window.showErrorMessage(`Error generating markdown: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function getWebviewContent(mainScriptUri: vscode.Uri) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${mainScriptUri.toString()} 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src vscode-resource:;">
        <title>AI-Pack Webview</title>
    </head>
    <body>
        <h1>AI-Pack Webview</h1>
        <p>This is a basic HTML test. If you can see this, the webview is working.</p>
        <div id="root"></div>
        <script type="module" src="${mainScriptUri}"></script>
        <script>
            console.log('Webview HTML loaded');
            console.log('React app script src:', '${mainScriptUri}');
            window.onerror = function(message, source, lineno, colno, error) {
                console.error('Error in webview:', message, 'at', source, lineno, colno, error);
            };
        </script>
    </body>
    </html>`;
}

async function generateFileTree(directoryPath: string, rootPath: string, includeDotFolders: boolean): Promise<string> {
    const tree: string[] = [path.basename(directoryPath)];

    async function traverse(dir: string, indent: string = ''): Promise<void> {
        const files = await fs.readdir(dir, { withFileTypes: true });

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const isLast = i === files.length - 1;
            const prefix = isLast ? '└── ' : '├── ';

            if (file.isDirectory() && (includeDotFolders || (!file.name.startsWith('.') && !['node_modules', 'dist'].includes(file.name)))) {
                tree.push(`${indent}${prefix}${file.name}`);
                await traverse(path.join(dir, file.name), indent + (isLast ? '    ' : '│   '));
            } else if (file.isFile() && !file.name.match(/\.(jpg|jpeg|png|gif|bmp|tiff|svg|lock|key)$/) && file.name !== 'package-lock.json') {
                tree.push(`${indent}${prefix}${file.name}`);
            }
        }
    }

    await traverse(directoryPath);
    return tree.join('\n');
}

async function combineFiles(rootPath: string, directoryPath: string, includeDotFolders: boolean): Promise<string> {
    let combinedContent = '';

    async function traverse(dir: string): Promise<void> {
        const files = await fs.readdir(dir, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(dir, file.name);

            if (file.isDirectory() && (includeDotFolders || (!file.name.startsWith('.') && !['node_modules', 'dist'].includes(file.name)))) {
                await traverse(fullPath);
            } else if (file.isFile() && !file.name.match(/\.(jpg|jpeg|png|gif|bmp|tiff|svg|lock|key)$/) && file.name !== 'package-lock.json') {
                const relativePath = path.relative(rootPath, fullPath);
                const content = await fs.readFile(fullPath, 'utf-8');
                const fileExtension = path.extname(fullPath).substring(1); // Extract extension and remove the dot
                combinedContent += `\n\n# ./${relativePath}\n\n\`\`\`${fileExtension}\n${content}\n\`\`\`\n`;
            }
        }
    }

    await traverse(directoryPath);
    return combinedContent;
}

export function deactivate() {}