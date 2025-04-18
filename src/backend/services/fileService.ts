import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as vscode from 'vscode';
import { logger } from '../../shared/logger';
import { ProcessingOptions } from './queueService';

export class FileService {
  // Lower threshold for testing purposes - original is 1000
  private MAX_FILES = 100;

  async generateFileTree(
    directoryPath: string,
    rootPath: string,
    includeDotFolders: boolean,
    options: ProcessingOptions,
    level = 0,
    relativePath = '',
  ): Promise<string> {
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      let tree = '';

      for (const entry of entries) {
        if (options.cancelToken?.isCancellationRequested) {
          break;
        }

        const fullPath = path.join(directoryPath, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);

        if (this.shouldSkip(entry.name, includeDotFolders)) {
          continue;
        }

        const prefix = '  '.repeat(level + 1);
        if (entry.isDirectory()) {
          tree += `${prefix}${entryRelativePath}/\n`;
          const subtree = await this.generateFileTree(
            fullPath,
            rootPath,
            includeDotFolders,
            options,
            level + 1,
            entryRelativePath,
          );
          tree += subtree;
        } else {
          tree += `${prefix}${entryRelativePath}\n`;
        }
      }

      return tree;
    } catch (error) {
      logger.error('Error generating file tree:', { error, directoryPath });
      throw error;
    }
  }

  async combineFiles(
    rootPath: string,
    directoryPath: string,
    includeDotFolders: boolean,
    options: ProcessingOptions,
  ): Promise<string> {
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      let combinedContent = '';

      for (const entry of entries) {
        if (options.cancelToken?.isCancellationRequested) {
          break;
        }

        if (this.shouldSkip(entry.name, includeDotFolders)) {
          continue;
        }

        const fullPath = path.join(directoryPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        if (entry.isDirectory()) {
          const subContent = await this.combineFiles(
            rootPath,
            fullPath,
            includeDotFolders,
            options,
          );
          if (subContent) {
            combinedContent += `\n// Directory: ${relativePath}\n${subContent}`;
          }
        } else {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const extension = path.extname(relativePath).substring(1);
            const languageId = extension.toLowerCase() || 'txt'; // Default to 'txt' if no extension
            combinedContent += `\n// File: ${relativePath}\n\n\`\`\`${languageId}\n${content}\n\`\`\`\n\n`;
          } catch (error) {
            logger.error('Error reading file:', { error, fullPath });
          }
        }
      }

      return combinedContent;
    } catch (error) {
      logger.error('Error combining files:', { error, directoryPath });
      throw error;
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      logger.error('Error reading file:', { error, filePath });
      throw error;
    }
  }

  async countFiles(
    directoryPath: string,
    options: ProcessingOptions,
    includeDotFolders = false, // Add parameter to include dot folders in counting
  ): Promise<number> {
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      let count = 0;

      for (const entry of entries) {
        if (options.cancelToken?.isCancellationRequested) {
          break;
        }

        if (this.shouldSkip(entry.name, includeDotFolders)) {
          continue;
        }

        if (entry.isDirectory()) {
          count += await this.countFiles(
            path.join(directoryPath, entry.name),
            options,
            includeDotFolders,
          );
        } else {
          count++;
        }
      }

      return count;
    } catch (error) {
      logger.error('Error counting files:', { error, directoryPath });
      throw error;
    }
  }

  async listDirectories(directoryPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      return entries
        .filter(
          (entry) => entry.isDirectory() && !this.shouldSkip(entry.name, false),
        )
        .map((entry) => entry.name);
    } catch (error) {
      logger.error('Error listing directories:', { error, directoryPath });
      throw error;
    }
  }

  isLargeDirectory(dirPath: string): boolean {
    let fileCount = 0;

    function countFiles(dir: string): void {
      try {
        const files = fsSync.readdirSync(dir);
        for (const file of files) {
          try {
            const filePath = path.join(dir, file);
            const stat = fsSync.statSync(filePath);
            if (stat.isDirectory()) {
              countFiles(filePath);
            } else {
              fileCount++;
              if (fileCount > 100) {
                // Use 100 as threshold for testing
                return;
              }
            }
          } catch (error) {
            // Skip files that can't be accessed
            continue;
          }
        }
      } catch (error) {
        // Skip directories that can't be accessed
        return;
      }
    }

    try {
      countFiles(dirPath);
      return fileCount > 100; // Use 100 as threshold for testing
    } catch (error) {
      return false;
    }
  }

  protected shouldSkip(name: string, includeDotFolders: boolean): boolean {
    // Handle dot folders based on the includeDotFolders flag
    if (!includeDotFolders && name.startsWith('.')) {
      logger.info(
        `Skipping '${name}' due to being a dot folder/file and includeDotFolders is false.`,
      );
      return true;
    }

    // Even if includeDotFolders is true, still check against ignore patterns
    const config = vscode.workspace.getConfiguration('aiContextGenerator');
    const ignorePatterns = config.get<string[]>('ignoreFolders') || [];

    // If includeDotFolders is true, don't ignore dot folders from configuration
    const effectiveIgnorePatterns = Array.isArray(ignorePatterns)
      ? includeDotFolders
        ? ignorePatterns.filter((pattern) => !pattern.startsWith('.'))
        : ignorePatterns
      : [];

    if (effectiveIgnorePatterns.includes(name)) {
      logger.info(`Skipping '${name}' due to ignore setting.`);
      return true;
    }

    return false;
  }
}
