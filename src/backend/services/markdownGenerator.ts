import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../../shared/logger';
import { FileService } from './fileService';
import { ContainerBase } from '../../di/container-base';
import { WebviewPanelProvider } from '../../di/types';
import { ProcessingOptions } from './queueService';

const DEFAULT_CHUNK_OPTIONS: ProcessingOptions = {
  chunkSize: 50,
  delayBetweenChunks: 10,
};

async function analyzeFileContent(content: string): Promise<string[]> {
  const insights: string[] = [];

  // Identify React components
  const isReactComponent =
    content.includes('import React') ||
    content.includes('from "react"') ||
    content.includes("from 'react'") ||
    (content.includes('<') && content.includes('/>')) || // JSX self-closing tag
    (content.includes('<') && content.includes('</') && content.includes('>')); // JSX opening/closing tags

  if (isReactComponent) {
    insights.push('React Component');

    // Check for component patterns
    if (
      content.includes('function') &&
      content.includes('return') &&
      content.includes('jsx')
    ) {
      insights.push('Functional Component');
    } else if (content.includes('=>') && content.includes('<')) {
      insights.push('Arrow Function Component');
    }
    if (
      content.includes('class') &&
      content.includes('extends React.Component')
    ) {
      insights.push('Class Component');
    }
    if (content.includes('props')) {
      insights.push('Uses Props');
    }
    if (content.includes('useState') || content.includes('useEffect')) {
      insights.push('Uses Hooks');
    }
  }

  return insights;
}

async function generateProjectOverview(
  rootPath: string,
  fileService: FileService,
  options: ProcessingOptions,
): Promise<string> {
  // Try to find package.json for project info
  try {
    const packageJsonContent = await fileService.readFile(
      path.join(rootPath, 'package.json'),
    );
    const packageJson = JSON.parse(packageJsonContent);
    return `## Project Overview
Name: ${packageJson.name || 'Unknown'}
Description: ${packageJson.description || 'No description available'}
Version: ${packageJson.version || 'Unknown'}
Dependencies: ${Object.keys(packageJson.dependencies || {}).length} packages
`;
  } catch {
    // If no package.json, provide a basic overview
    const fileCount = await fileService.countFiles(rootPath, options);
    const dirs = await fileService.listDirectories(rootPath);
    return `## Project Overview
Location: ${path.basename(rootPath)}
Structure: ${dirs.length} main directories
Files: ${fileCount} files total
`;
  }
}

export async function generateMarkdown(
  rootPath: string,
  directoryPath: string,
  context: vscode.ExtensionContext,
  includeDotFolders: boolean,
  isRoot: boolean,
  fileService: FileService,
  container: ContainerBase,
): Promise<void> {
  logger.info('Entering generateMarkdown function', {
    rootPath,
    directoryPath,
    includeDotFolders,
    isRoot,
  });

  try {
    const webviewPanelService = container.resolve<WebviewPanelProvider>(
      'webviewPanelService',
    );
    const panel = webviewPanelService.getOrCreateWebviewPanel(
      context,
      container,
    );

    // Create cancellation token
    const tokenSource = new vscode.CancellationTokenSource();
    const options: ProcessingOptions = {
      ...DEFAULT_CHUNK_OPTIONS,
      cancelToken: tokenSource.token,
    };

    // Start with file tree generation
    const fileTree = await fileService.generateFileTree(
      directoryPath,
      rootPath,
      includeDotFolders,
      options,
    );

    // Update UI with file tree first
    panel.webview.postMessage({
      command: 'updateFileTree',
      fileTree,
      isRoot,
      mode: isRoot ? 'root' : 'directory',
    });

    // Then process file contents
    const combinedContent = await fileService.combineFiles(
      rootPath,
      directoryPath,
      includeDotFolders,
      options,
    );

    // Analyze content for insights
    const insights = await analyzeFileContent(combinedContent);
    const insightsSection =
      insights.length > 0 ? `\n## Code Insights\n${insights.join('\n')}\n` : '';

    // Create markdown content
    let markdownContent = `# ${path.basename(directoryPath)} Context\n\n`;

    // Add project overview for root folders
    if (isRoot) {
      markdownContent +=
        (await generateProjectOverview(rootPath, fileService, options)) + '\n';
    }

    markdownContent +=
      `## File Structure\n\`\`\`\n${fileTree}\n\`\`\`\n` +
      insightsSection +
      `\n## File Contents\n\`\`\`\n${combinedContent}\n\`\`\`\n`;

    // Save markdown file
    const fileName = isRoot ? 'root-context.md' : 'context.md';
    const markdownPath = path.join(directoryPath, fileName);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(markdownPath),
      Buffer.from(markdownContent),
    );

    // Final update with all content
    panel.webview.postMessage({
      command: 'updateContent',
      fileTree,
      combinedContent,
      isRoot,
      mode: isRoot ? 'root' : 'directory',
    });
  } catch (error) {
    handleGenerateMarkdownError(error);
  }
}

function handleGenerateMarkdownError(error: unknown): void {
  logger.error('Error in generateMarkdown:', { error });
  if (error instanceof Error) {
    vscode.window.showErrorMessage(
      `Failed to generate markdown: ${error.message}`,
    );
  } else {
    vscode.window.showErrorMessage('Failed to generate markdown');
  }
}
