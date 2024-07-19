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

        let fileTreeCache = '';
        let combinedContentCache = '';
        let rootFileTreeCache = '';
        let rootCombinedContentCache = '';

        let initialLoad = true;  // Add this line to declare the variable

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

                console.log('Sending content to webview');
                panel.webview.postMessage({ 
                    command: 'updateContent',
                    fileTree: fileTree,
                    combinedContent: combinedContent,
                    isRoot: isRoot
                });
            } catch (error) {
                console.error('Error in renderContent:', error);
                vscode.window.showErrorMessage(`Error generating AI context: ${error instanceof Error ? error.message : String(error)}`);
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

function getWebviewContent(toolkitUri: vscode.Uri, codiconsUri: vscode.Uri, isRoot: boolean) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script type="module" src="${toolkitUri}"></script>
        <link href="${codiconsUri}" rel="stylesheet" />
        <title>AI-Pack Webview</title>
        <style>
            body { 
                padding: 20px; 
                --vscode-button-icon-size: 16px;
            }
            pre { 
                white-space: pre-wrap; 
                word-break: break-all; 
                background-color: var(--vscode-textCodeBlock-background);
                padding: 10px;
                border-radius: 3px;
            }
            .theme-box { 
                border: 1px solid var(--vscode-editor-foreground); 
                padding: 10px; 
                margin-bottom: 10px; 
            }
            .controls {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
                align-items: center;
            }
            .section-header {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                margin-bottom: 10px;
            }
            .title {
                display: flex;
                align-items: center;
            }
            h2 {
                margin: 5px 0; /* Reduced margin for headings */
            }
            .content-box {
                margin-top: 10px;
            }
            .header-controls {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }
        </style>
    </head>
    <body>
        <div class="theme-box controls">
            <vscode-button id="copyAll" appearance="primary">
                <span slot="start" class="codicon codicon-copy"></span>
                Copy All
            </vscode-button>
            ${isRoot ? '' : `
            <vscode-radio-group orientation="horizontal">
                <vscode-radio value="directory" checked>Directory Mode</vscode-radio>
                <vscode-radio value="root">Root Mode</vscode-radio>
            </vscode-radio-group>
            `}
        </div>

        <div class="theme-box">
            <div class="section-header">
                <div class="header-controls">
                    <vscode-button id="copyFileTree">
                        <span slot="start" class="codicon codicon-copy"></span>
                        Copy
                    </vscode-button>
                    ${isRoot ? '' : '<vscode-checkbox id="toggleRootFiletree">Toggle Root</vscode-checkbox>'}
                </div>
                <div class="title">
                    <h2>Tree</h2>
                </div>
            </div>
            <div class="content-box">
                <pre id="fileTree"></pre>
            </div>
        </div>

        <div class="theme-box">
            <div class="section-header">
                <div class="header-controls">
                    <vscode-button id="copyCombinedContent">
                        <span slot="start" class="codicon codicon-copy"></span>
                        Copy
                    </vscode-button>
                    ${isRoot ? '' : '<vscode-checkbox id="toggleRootCombined">Toggle Root</vscode-checkbox>'}
                </div>
                <div class="title">
                    <h2>Files</h2>
                </div>
            </div>
            <div class="content-box">
                <pre id="combinedContent"></pre>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            window.addEventListener('message', event => {
                const message = event.data;
                console.log('Received message:', message);
                switch (message.command) {
                    case 'updateContent':
                        console.log('Updating file tree content');
                        document.getElementById('fileTree').textContent = message.fileTree;
                        console.log('File tree content updated');
                        console.log('Updating combined content');
                        document.getElementById('combinedContent').textContent = message.combinedContent;
                        console.log('Combined content updated');
                        break;
                }
            });

            document.getElementById('copyFileTree').addEventListener('click', () => {
                vscode.postMessage({ command: 'copyToClipboard', content: document.getElementById('fileTree').textContent });
            });

            document.getElementById('copyCombinedContent').addEventListener('click', () => {
                vscode.postMessage({ command: 'copyToClipboard', content: document.getElementById('combinedContent').textContent });
            });

            const copyAllButton = document.getElementById('copyAll');
            if (copyAllButton) {
                copyAllButton.addEventListener('click', () => {
                    const allContent = document.getElementById('fileTree').textContent + '\\n\\n' + document.getElementById('combinedContent').textContent;
                    vscode.postMessage({ command: 'copyToClipboard', content: allContent });
                });
            }

            const toggleRootFiletree = document.getElementById('toggleRootFiletree');
            const toggleRootCombined = document.getElementById('toggleRootCombined');
            if (toggleRootFiletree) {
                toggleRootFiletree.addEventListener('change', (event) => {
                    vscode.postMessage({ command: 'toggleRootFiletree', checked: event.target.checked });
                });
            }

            if (toggleRootCombined) {
                toggleRootCombined.addEventListener('change', (event) => {
                    vscode.postMessage({ command: 'toggleRootCombined', checked: event.target.checked });
                });
            }

            const radioGroup = document.querySelector('vscode-radio-group');
            if (radioGroup) {
                radioGroup.addEventListener('change', (event) => {
                    const isRootMode = event.target.value === 'root';
                    if (toggleRootFiletree) toggleRootFiletree.disabled = isRootMode;
                    if (toggleRootCombined) toggleRootCombined.disabled = isRootMode;
                    if (isRootMode) {
                        vscode.postMessage({ command: 'toggleRootFiletree', checked: true });
                        vscode.postMessage({ command: 'toggleRootCombined', checked: true });
                    } else {
                        vscode.postMessage({ command: 'toggleRootFiletree', checked: false });
                        vscode.postMessage({ command: 'toggleRootCombined', checked: false });
                    }
                });
            }

            vscode.postMessage({ command: 'webviewLoaded' });
            vscode.postMessage({ command: 'renderContent' });
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


