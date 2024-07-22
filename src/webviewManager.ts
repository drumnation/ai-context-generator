import * as vscode from 'vscode';

export function getWebviewContent(
  toolkitUri: vscode.Uri,
  codiconsUri: vscode.Uri,
  isRoot: boolean,
) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    ${getHead()}
    ${getBody(isRoot)}
    </html>`;
}

function getHead() {
  return `
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script type="module" src="https://unpkg.com/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.js"></script>
        <link href="https://unpkg.com/@vscode/codicons@0.0.36/dist/codicon.css" rel="stylesheet" />
        <title>AI-Pack Webview</title>
        ${getStyles()}
    </head>`;
}

function getStyles() {
  return `
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
            position: relative;
            min-height: 100px;
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
            margin: 5px 0;
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
        .error-message {
            color: var(--vscode-errorForeground);
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border: 1px solid var(--vscode-errorForeground);
            border-radius: 3px;
        }
        .error-icon {
            font-size: 24px;
        }
        .spinner-container {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .spinner {
            display: block;
        }
        .file-checkbox {
            display: flex;
            align-items: center;
        }
        .file-checkbox input {
            margin-right: 5px;
        }
        .file-checkbox label {
            margin-right: 10px;
        }
    </style>`;
}

function getBody(isRoot: boolean) {
  return `
    <body>
        ${getControlsSection(isRoot)}
        ${getFileTreeSection(isRoot)}
        ${getCombinedContentSection(isRoot)}
        ${getErrorMessageSection()}
        ${getScript()}
    </body>`;
}

function getControlsSection(isRoot: boolean) {
  return `
    <div class="theme-box controls">
        <vscode-button id="copyAll" appearance="primary">
            <span slot="start" class="codicon codicon-copy"></span>
            Copy All
        </vscode-button>
        ${
          isRoot
            ? ''
            : `
        <vscode-radio-group orientation="horizontal">
            <vscode-radio value="directory" checked>Directory Mode</vscode-radio>
            <vscode-radio value="root">Root Mode</vscode-radio>
        </vscode-radio-group>
        `
        }
        <vscode-checkbox id="toggleFiles">Toggle Files</vscode-checkbox>
    </div>`;
}

function getFileTreeSection(isRoot: boolean) {
  return `
    <div class="theme-box" id="fileTreeSection">
        <div class="spinner-container spinner" id="spinnerFileTree">
            <vscode-progress-ring></vscode-progress-ring>
        </div>
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
    </div>`;
}

function getCombinedContentSection(isRoot: boolean) {
  return `
    <div class="theme-box" id="combinedContentSection">
        <div class="spinner-container spinner" id="spinnerCombinedContent">
            <vscode-progress-ring></vscode-progress-ring>
        </div>
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
    </div>`;
}

function getErrorMessageSection() {
  return `
    <div class="error-message" id="errorMessage" style="display: none;">
        <span class="codicon codicon-error error-icon"></span>
        <span>There was an error generating the content. Please try again.</span>
    </div>`;
}

function getScript() {
  return `
    <script>
        const vscode = acquireVsCodeApi();
        let fileSelections = {};

        window.addEventListener('message', event => {
            const message = event.data;
            console.log('Received message:', message);
            switch (message.command) {
                case 'updateContent':
                    updateContent(message);
                    break;
                case 'showError':
                    showError();
                    break;
            }
        });

        function updateContent(message) {
            updateFileTree(message.fileTree);
            document.getElementById('combinedContent').textContent = message.combinedContent;
            document.getElementById('fileTreeSection').style.display = 'block';
            document.getElementById('combinedContentSection').style.display = 'block';
            document.getElementById('errorMessage').style.display = 'none';
            document.getElementById('spinnerFileTree').style.display = 'none';
            document.getElementById('spinnerCombinedContent').style.display = 'none';
        }

        function updateFileTree(fileTree) {
            const fileTreeContainer = document.getElementById('fileTree');
            fileTreeContainer.innerHTML = '';
            fileTree.split('\\n').forEach(file => {
                const div = createFileCheckbox(file);
                fileTreeContainer.appendChild(div);
            });
        }

        function createFileCheckbox(file) {
            const div = document.createElement('div');
            div.classList.add('file-checkbox');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = fileSelections[file] !== false;
            checkbox.addEventListener('change', (e) => {
                fileSelections[file] = e.target.checked;
                vscode.postMessage({
                    command: 'fileSelectionChanged',
                    selections: fileSelections
                });
            });
            const label = document.createElement('label');
            label.textContent = file;
            div.appendChild(checkbox);
            div.appendChild(label);
            return div;
        }

        function showError() {
            document.getElementById('fileTreeSection').style.display = 'none';
            document.getElementById('combinedContentSection').style.display = 'none';
            document.getElementById('errorMessage').style.display = 'flex';
            document.getElementById('spinnerFileTree').style.display = 'none';
            document.getElementById('spinnerCombinedContent').style.display = 'none';
        }

        document.getElementById('copyFileTree').addEventListener('click', copyFileTree);
        document.getElementById('copyCombinedContent').addEventListener('click', copyCombinedContent);
        document.getElementById('copyAll').addEventListener('click', copyAll);

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
            radioGroup.addEventListener('change', handleRadioGroupChange);
        }

        const toggleFiles = document.getElementById('toggleFiles');
        if (toggleFiles) {
            toggleFiles.addEventListener('change', handleToggleFiles);
        }

        function copyFileTree() {
            const fileTreeText = Array.from(document.querySelectorAll('.file-checkbox label'))
                .map(label => label.textContent)
                .join('\\n');
            vscode.postMessage({ command: 'copyToClipboard', content: fileTreeText });
        }

        function copyCombinedContent() {
            vscode.postMessage({ command: 'copyToClipboard', content: document.getElementById('combinedContent').textContent });
        }

        function copyAll() {
            const fileTreeText = Array.from(document.querySelectorAll('.file-checkbox label'))
                .map(label => label.textContent)
                .join('\\n');
            const allContent = fileTreeText + '\\n\\n' + document.getElementById('combinedContent').textContent;
            vscode.postMessage({ command: 'copyToClipboard', content: allContent });
        }

        function handleRadioGroupChange(event) {
            const isRootMode = event.target.value === 'root';
            if (toggleRootFiletree) toggleRootFiletree.disabled = isRootMode;
            if (toggleRootCombined) toggleRootCombined.disabled = isRootMode;
            vscode.postMessage({ command: 'toggleRootFiletree', checked: isRootMode });
            vscode.postMessage({ command: 'toggleRootCombined', checked: isRootMode });
        }

        function handleToggleFiles(event) {
            const checkboxes = document.querySelectorAll('.file-checkbox input');
            checkboxes.forEach(checkbox => {
                checkbox.checked = event.target.checked;
                fileSelections[checkbox.nextSibling.textContent] = checkbox.checked;
            });
            vscode.postMessage({ command: 'fileSelectionChanged', selections: fileSelections });
        }

        vscode.postMessage({ command: 'webviewLoaded' });
        vscode.postMessage({ command: 'renderContent' });
    </script>`;
}
