import * as vscode from 'vscode';
import * as path from 'path';
import { FileService } from './fileService';
import { logger } from '../../shared/logger';
import { ProcessingOptions, DEFAULT_CHUNK_OPTIONS } from '../../shared/types';

/**
 * A simplified version of the markdown generator that works with minimal dependencies
 * and doesn't rely on complex message passing architecture.
 */
export async function generateSimplifiedMarkdown(
  rootPath: string,
  directoryPath: string,
  context: vscode.ExtensionContext,
  includeDotFolders: boolean,
  isRoot: boolean,
  fileService: FileService,
): Promise<void> {
  // Create cancellation token source
  const tokenSource = new vscode.CancellationTokenSource();

  // Create progress indicator
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: isRoot
        ? 'Generating AI Context for Root Folder'
        : 'Generating AI Context',
      cancellable: true,
    },
    async (progress, token) => {
      // Set up cancellation
      token.onCancellationRequested(() => {
        logger.info('User cancelled operation');
        tokenSource.cancel();
      });

      // Create processing options
      const options: ProcessingOptions = {
        ...DEFAULT_CHUNK_OPTIONS,
        cancelToken: tokenSource.token,
      };

      try {
        // Create webview panel directly
        const panel = vscode.window.createWebviewPanel(
          'aiContext',
          isRoot
            ? 'AI-Context (Root)'
            : `AI-Context (${path.basename(directoryPath)})`,
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
              vscode.Uri.joinPath(context.extensionUri, 'dist'),
            ],
          },
        );

        // Set initial HTML with loading indicator
        panel.webview.html = getLoadingWebviewContent();

        // Start operations
        progress.report({ message: 'Scanning files...', increment: 10 });

        // Generate file tree
        let fileTree = '';
        try {
          fileTree = await fileService.generateFileTree(
            directoryPath,
            rootPath,
            includeDotFolders,
            options,
          );
          progress.report({ message: 'File tree generated', increment: 40 });
        } catch (err) {
          logger.error('Error generating file tree:', { error: err });
          throw err;
        }

        if (token.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        // Get all file paths from the tree for selective processing
        const _allFilePaths = extractFilePaths(fileTree, directoryPath);

        // Combine files
        let combinedContent = '';
        try {
          combinedContent = await fileService.combineFiles(
            rootPath,
            directoryPath,
            includeDotFolders,
            options,
          );
          progress.report({ message: 'Files combined', increment: 40 });
        } catch (err) {
          logger.error('Error combining files:', { error: err });
          throw err;
        }

        if (token.isCancellationRequested) {
          throw new Error('Operation cancelled');
        }

        // Keep track of file content by path
        const fileContentsMap = new Map<string, string>();

        // Store the original combined content
        const allFilesContent = combinedContent;

        // Parse individual file contents from the combined content
        parseFileContents(allFilesContent, fileContentsMap);

        // Update webview with content
        progress.report({ message: 'Updating UI...', increment: 10 });
        panel.webview.html = getWebviewContent(
          fileTree,
          combinedContent,
          isRoot,
          directoryPath,
          rootPath,
        );

        // Set up message handling for copy operations and regeneration
        panel.webview.onDidReceiveMessage(
          async (message) => {
            switch (message.command) {
              case 'openRootContext':
                logger.info(
                  '[SimplifiedMarkdown] Received openRootContext command from webview',
                );
                vscode.commands.executeCommand('ai-pack.simpleMarkdownRoot');
                break;

              case 'copyToClipboard':
                vscode.env.clipboard.writeText(message.content);
                vscode.window.showInformationMessage(
                  'Content copied to clipboard',
                );
                break;

              case 'regenerateContent':
                if (Array.isArray(message.selectedFiles)) {
                  try {
                    logger.info('Regenerating content with selected files:', {
                      selectedFiles: message.selectedFiles,
                      selectedCount: message.selectedFiles.length,
                    });

                    // Generate new combined content based on selected files only
                    let newContent = '';

                    // Add selected files to the content
                    for (const filePath of message.selectedFiles) {
                      const content = fileContentsMap.get(filePath);
                      if (!content) {
                        // logger.warn(`No content found for selected file: "${filePath}". Available keys: ${JSON.stringify(Array.from(fileContentsMap.keys()))}`);
                      }

                      if (content) {
                        newContent += content;
                      } else {
                        // logger.warn already logged above
                      }
                    }

                    // If no files were selected, show a message
                    if (newContent.trim() === '') {
                      newContent =
                        '\n\n// No files selected. Please select files in the file tree.\n\n';
                    }

                    // Send updated content back to webview
                    panel.webview.postMessage({
                      command: 'contentUpdated',
                      content: escapeHtml(newContent),
                    });

                    vscode.window.showInformationMessage(
                      `Content regenerated with ${message.selectedFiles.length} files`,
                    );
                  } catch (error) {
                    logger.error('Error regenerating content:', { error });
                    vscode.window.showErrorMessage(
                      `Error regenerating content: ${error instanceof Error ? error.message : String(error)}`,
                    );
                  }
                }
                break;
            }
          },
          undefined,
          context.subscriptions,
        );

        progress.report({ message: 'Complete', increment: 100 });
      } catch (error) {
        if (error instanceof Error && error.message === 'Operation cancelled') {
          logger.info('Operation cancelled by user');
        } else {
          logger.error('Error in generateSimplifiedMarkdown:', { error });
          vscode.window.showErrorMessage(
            `Failed to generate markdown: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } finally {
        // Clean up resources
        tokenSource.dispose();
      }
    },
  );
}

function getLoadingWebviewContent(): string {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI-Pack Loading</title>
      <style>
          body { 
              padding: 20px;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .spinner {
              width: 50px;
              height: 50px;
              border: 5px solid rgba(0, 0, 0, 0.1);
              border-radius: 50%;
              border-top-color: var(--vscode-editor-foreground, #333);
              animation: spin 1s ease-in-out infinite;
              margin-bottom: 20px;
          }
          @keyframes spin {
              to { transform: rotate(360deg); }
          }
      </style>
  </head>
  <body>
      <div class="spinner"></div>
      <h2>Generating AI Context...</h2>
      <p>Please wait while we analyze your files.</p>
  </body>
  </html>`;
}

function getWebviewContent(
  fileTree: string,
  combinedContent: string,
  isRoot: boolean,
  directoryPath: string,
  rootPath: string,
): string {
  // Convert file tree string to a structured format for rendering with checkboxes
  const lines = fileTree.split('\n');
  const structuredTree = convertFileTreeToStructured(
    lines,
    rootPath,
    directoryPath,
  );

  // Format a pretty version of the file tree for copying
  const prettyFileTree = formatPrettyFileTree(fileTree, directoryPath);

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AI-Pack Webview</title>
      <style>
          body { 
              padding: 20px; 
              font-family: var(--vscode-font-family, system-ui, -apple-system, sans-serif);
          }
          pre { 
              white-space: pre-wrap; 
              word-break: break-all; 
              background-color: var(--vscode-textCodeBlock-background, #f0f0f0);
              padding: 10px;
              border-radius: 3px;
              overflow: auto;
              font-family: var(--vscode-editor-font-family, monospace);
          }
          .theme-box { 
              border: 1px solid var(--vscode-editor-foreground, #ccc); 
              padding: 10px; 
              margin-bottom: 20px; 
              position: relative;
          }
          .controls {
              display: flex;
              gap: 10px;
              margin-bottom: 20px;
              align-items: center;
          }
          .section-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
          }
          button {
              background-color: var(--vscode-button-background, #0078d4);
              color: var(--vscode-button-foreground, white);
              border: none;
              padding: 8px 12px;
              border-radius: 2px;
              cursor: pointer;
              font-size: 12px;
              margin-left: 10px;
          }
          button:hover {
              background-color: var(--vscode-button-hoverBackground, #0066b5);
          }
          h2 {
              margin: 5px 0;
          }
          .file-tree {
              font-family: var(--vscode-editor-font-family, monospace);
          }
          .tree-item {
              padding: 2px 0;
              display: flex;
              align-items: center;
          }
          .tree-item label {
              display: flex;
              align-items: center;
              cursor: pointer;
          }
          .tree-item input[type="checkbox"] {
              margin-right: 5px;
          }
          .folder {
              font-weight: bold;
              cursor: pointer;
          }
          .indented {
              margin-left: 20px;
          }
          .folder-content {
              margin-left: 20px;
          }
          .hidden {
              display: none;
          }
          .spinner {
              border: 3px solid rgba(0, 0, 0, 0.1);
              border-radius: 50%;
              border-top: 3px solid var(--vscode-button-background, #0078d4);
              width: 16px;
              height: 16px;
              animation: spin 1s linear infinite;
              display: inline-block;
              margin-left: 5px;
          }
          @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
          }
          #originalFileTree {
              display: none; /* Hide the original file tree used for copying */
          }
          #prettyFileTree {
              display: none; /* Hide the pretty file tree used for copying */
          }
          #regeneratingIndicator {
              color: var(--vscode-editorInfo-foreground, #3794ff);
              font-size: 12px;
              margin-left: 10px;
              display: none;
          }
      </style>
  </head>
  <body>
      <div class="theme-box controls">
          <h2>${isRoot ? 'AI Context for Workspace Root' : `AI Context for ${directoryPath.split('/').pop() || directoryPath}`}</h2>
          <div>
              <button id="selectAll">Select All</button>
              <button id="selectNone">Deselect All</button>
              <span id="regeneratingIndicator">Updating...</span>
              <button id="copyAll">Copy All</button>
          </div>
      </div>

      <div class="theme-box">
          <div class="section-header">
              <h2>File Tree</h2>
              <button id="copyFileTree">Copy</button>
          </div>
          <div class="file-tree" id="fileTreeContainer">
              ${structuredTree}
          </div>
          <!-- Original file tree in a hidden pre tag, used for copying -->
          <pre id="originalFileTree" class="hidden">${escapeHtml(fileTree)}</pre>
          <!-- Pretty file tree in a hidden pre tag, used for copying -->
          <pre id="prettyFileTree" class="hidden">${escapeHtml(prettyFileTree)}</pre>
      </div>

      <div class="theme-box">
          <div class="section-header">
              <h2>Files Content</h2>
              <button id="copyCombinedContent">Copy</button>
          </div>
          <pre id="combinedContent">${escapeHtml(combinedContent)}</pre>
      </div>

      <script>
          console.log('[Webview Script] Starting...');
          const vscode = acquireVsCodeApi();
          let debounceTimer;
          
          console.log('[Webview Script] Setting up folder toggle listeners...');
          // Set up tree view behavior
          document.querySelectorAll('.folder').forEach(folder => {
              folder.addEventListener('click', (e) => {
                  // Only toggle when clicking directly on the folder text, not the checkbox
                  if (e.target === folder) {
                      const content = folder.nextElementSibling;
                      content.classList.toggle('hidden');
                  }
              });
          });
          
          console.log('[Webview Script] Defining regeneration functions...');
          // Function to update content when checkboxes change
          function regenerateContentFromCheckboxes() {
              console.log('[Webview Script] regenerateContentFromCheckboxes called');
              // Abort any ongoing regeneration if a new one starts
              vscode.postMessage({ command: 'cancelOperation' });
              
              // Show loading indicator
              const indicator = document.getElementById('regeneratingIndicator');
              indicator.style.display = 'inline';
              
              // Get all checked file paths
              const selectedFiles = [];
              document.querySelectorAll('input[type="checkbox"].file-checkbox:checked').forEach(checkbox => {
                  const path = checkbox.getAttribute('data-path');
                  if (path) {
                      selectedFiles.push(path);
                  }
              });
              
              console.log('[Webview Script] Selected files for regeneration:', selectedFiles);
              
              // Send selected files to the extension
              vscode.postMessage({ 
                  command: 'regenerateContent',
                  selectedFiles: selectedFiles
              });
          }
          
          // Debounce function to prevent too many updates
          function debounceRegenerate() {
              clearTimeout(debounceTimer);
              debounceTimer = setTimeout(regenerateContentFromCheckboxes, 300);
          }
          
          console.log('[Webview Script] Setting up checkbox change listeners...');
          // Set up checkboxes
          document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
              checkbox.addEventListener('change', (e) => {
                  console.log('[Webview Script] Checkbox changed:', e.target.dataset.path, e.target.checked);
                  const isChecked = e.target.checked;
                  
                  // If this is a folder, update all its children
                  if (e.target.classList.contains('folder-checkbox')) {
                      const container = e.target.closest('.tree-item').nextElementSibling;
                      if (container) {
                          container.querySelectorAll('input[type="checkbox"]').forEach(child => {
                              child.checked = isChecked;
                          });
                      }
                  }
                  
                  // Update parent folders (if all siblings are checked, the parent should be checked)
                  updateParentFolders(e.target);
                  
                  // Trigger content regeneration
                  debounceRegenerate();
              });
          });
          
          function updateParentFolders(checkbox) {
              console.log('[Webview Script] updateParentFolders called for:', checkbox.dataset.path);
              // Find the parent folder
              let item = checkbox.closest('.folder-content');
              if (!item) {
                  console.log('[Webview Script] updateParentFolders: No parent folder-content found.');
                  return;
              }
              
              let parentItem = item.previousElementSibling;
              if (!parentItem) return;
              
              let parentCheckbox = parentItem.querySelector('input[type="checkbox"]');
              if (!parentCheckbox) return;
              
              // Check if all siblings are checked
              const siblingCheckboxes = Array.from(item.querySelectorAll(':scope > .tree-item > label > input[type="checkbox"]'));
              const allChecked = siblingCheckboxes.every(cb => cb.checked);
              const anyChecked = siblingCheckboxes.some(cb => cb.checked);
              
              parentCheckbox.checked = allChecked;
              parentCheckbox.indeterminate = anyChecked && !allChecked;
              
              // Recursively update parents
              updateParentFolders(parentCheckbox);
          }
          
          console.log('[Webview Script] Setting up Select/Deselect All listeners...');
          // Select/Deselect all
          document.getElementById('selectAll').addEventListener('click', () => {
              console.log('[Webview Script] Select All clicked.');
              document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                  checkbox.checked = true;
                  checkbox.indeterminate = false;
              });
              
              // Trigger content regeneration
              regenerateContentFromCheckboxes();
          });
          
          document.getElementById('selectNone').addEventListener('click', () => {
              console.log('[Webview Script] Select None clicked.');
              document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                  checkbox.checked = false;
                  checkbox.indeterminate = false;
              });
              
              // Trigger content regeneration
              regenerateContentFromCheckboxes();
          });
          
          console.log('[Webview Script] Setting up Copy button listeners...');
          // Copy buttons - use the pretty tree for copying
          document.getElementById('copyFileTree').addEventListener('click', () => {
              console.log('[Webview Script] Copy File Tree clicked.');
              vscode.postMessage({ 
                  command: 'copyToClipboard', 
                  content: document.getElementById('prettyFileTree').textContent 
              });
          });

          document.getElementById('copyCombinedContent').addEventListener('click', () => {
              console.log('[Webview Script] Copy Combined Content clicked.');
              vscode.postMessage({ 
                  command: 'copyToClipboard', 
                  content: document.getElementById('combinedContent').textContent 
              });
          });

          document.getElementById('copyAll').addEventListener('click', () => {
              console.log('[Webview Script] Copy All clicked.');
              vscode.postMessage({ 
                  command: 'copyToClipboard', 
                  content: document.getElementById('prettyFileTree').textContent + '\\n\\n' + 
                           document.getElementById('combinedContent').textContent 
              });
          });
          
          console.log('[Webview Script] Setting up window message listener...');
          // Handle messages from the extension
          window.addEventListener('message', event => {
              const message = event.data;
              console.log('[Webview Script] Message received from extension:', message.command);
              
              if (message.command === 'contentUpdated') {
                  // Update the combined content
                  document.getElementById('combinedContent').innerHTML = message.content;
                  
                  // Hide the updating indicator
                  document.getElementById('regeneratingIndicator').style.display = 'none';
              }
          });
          
          console.log('[Webview Script] Expanding folders...');
          // Expand all folders on load and initialize content
          document.querySelectorAll('.folder-content').forEach(content => {
              content.classList.remove('hidden');
          });
          
          // Run initial regeneration to match selected files on load
          // setTimeout(regenerateContentFromCheckboxes, 500);

          console.log('[Webview Script] Initialization complete.');
          
          // NOTE: Checkbox change listener already added above inside the forEach loop
      </script>
  </body>
  </html>`;
}

// Helper function to convert file tree string to structured HTML with checkboxes
function convertFileTreeToStructured(
  lines: string[],
  rootPath: string,
  directoryPath: string,
): string {
  if (lines.length === 0 || !lines[0]) {
    return '';
  }

  let html = '';
  let currentIndent = 0;
  const indentStack: number[] = [];
  // Get the path part of directoryPath relative to rootPath
  const baseRelativePath = path.relative(rootPath, directoryPath);

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) {
      continue;
    }

    // Calculate indentation level
    const match = lines[i].match(/^(\s*)(.*)/);
    if (!match) {
      continue;
    }

    const [, indent, text] = match;
    const level = indent.length;

    // Handle indentation changes
    if (level > currentIndent) {
      indentStack.push(currentIndent);
      currentIndent = level;
      html += '<div class="folder-content">';
    } else if (level < currentIndent) {
      while (indentStack.length > 0 && level < currentIndent) {
        html += '</div>'; // Close folder-content
        currentIndent = indentStack.pop() || 0;
      }
    }

    const isFolder = text.endsWith('/');
    const entryRelativePath = isFolder ? text.slice(0, -1) : text; // Path relative to directoryPath
    const cleanedText = entryRelativePath.trim();

    // Construct the path relative to the workspace root for data-path
    const workspaceRelativePath = baseRelativePath
      ? path.join(baseRelativePath, entryRelativePath)
      : entryRelativePath;

    if (isFolder) {
      html += `
        <div class="tree-item">
          <label>
            <input type="checkbox" class="folder-checkbox" data-path="${escapeHtml(workspaceRelativePath)}" checked>
            <span class="folder">${escapeHtml(cleanedText)}</span>
          </label>
        </div>
      `;
    } else {
      html += `
        <div class="tree-item">
          <label>
            <input type="checkbox" class="file-checkbox" data-path="${escapeHtml(workspaceRelativePath)}" checked>
            <span>${escapeHtml(cleanedText)}</span>
          </label>
        </div>
      `;
    }
  }

  // Close any remaining open folder-content divs
  while (indentStack.length > 0) {
    html += '</div>';
    indentStack.pop();
  }

  return html;
}

// Helper function to escape HTML content
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper function to extract file paths from file tree
function extractFilePaths(fileTree: string, _basePath: string): string[] {
  const paths: string[] = [];
  const lines = fileTree.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.endsWith('/')) {
      // This is a file, not a directory
      paths.push(line);
    }
  }

  return paths;
}

// Helper function to parse file contents from combined content
function parseFileContents(
  combinedContent: string,
  fileContentsMap: Map<string, string>,
): void {
  // Expected format from combineFiles:
  // // File: path/relative/to/rootPath/file.ext
  // content...
  // // File: another/path/relative/to/rootPath/file.ext
  // content...

  const fileMarker = '// File: ';
  const sections = combinedContent.split(`\n${fileMarker}`);

  for (let i = 1; i < sections.length; i++) {
    // Start from 1 to skip potential leading empty string
    const section = sections[i];
    const firstNewline = section.indexOf('\n');
    if (firstNewline !== -1) {
      // Extract the full path relative to the workspace root
      const fullFilePath = section.substring(0, firstNewline).trim();

      // Reconstruct the full section content as it was originally
      const fullContent = `\n${fileMarker}${section}`;

      // Add to file contents map
      fileContentsMap.set(fullFilePath, fullContent);
    }
  }

  logger.info(`Parsed ${fileContentsMap.size} files from the combined content`);
}

// Format file tree with nice ASCII tree characters for copying
function formatPrettyFileTree(fileTree: string, directoryPath: string): string {
  // Re-add the previously deleted function content here...
  const lines = fileTree.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return '';
  }
  const rootName = path.basename(directoryPath);
  const result: string[] = [`📁 ${rootName}`];
  interface TreeNode {
    text: string;
    level: number;
    isLast: boolean;
    isDirectory: boolean;
  }
  const nodes: TreeNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*)(.+)$/);
    if (match) {
      const [, indent, text] = match;
      const level = indent.length / 2 + 1;
      const isDirectory = text.endsWith('/');
      const cleanText = isDirectory ? text.substring(0, text.length - 1) : text;
      nodes.push({
        text: cleanText,
        level,
        isLast: false,
        isDirectory,
      });
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    const currentLevel = nodes[i].level;
    let j = i + 1;
    while (j < nodes.length && nodes[j].level > currentLevel) {
      j++;
    }
    if (j === nodes.length || nodes[j].level < currentLevel) {
      nodes[i].isLast = true;
    } else if (nodes[j].level === currentLevel) {
      nodes[i].isLast = false;
    }
  }
  const previousLevels: boolean[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const { text, level, isLast, isDirectory } = nodes[i];
    let line = '';
    for (let j = 0; j < level - 1; j++) {
      line += previousLevels[j] ? '│   ' : '    ';
    }
    if (level > 0) {
      line += isLast ? '└── ' : '├── ';
    }
    const icon = isDirectory ? '📁 ' : '📄 ';
    line += icon + text;
    result.push(line);
    if (level >= previousLevels.length) {
      previousLevels.push(!isLast);
    } else {
      previousLevels[level - 1] = !isLast;
    }
  }
  return result.join('\n');
}
