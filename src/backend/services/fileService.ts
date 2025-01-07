import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { logger } from '../../shared/logger';
import { ProcessingOptions } from './queueService';

export class FileService {
  protected readonly excludedFolders = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
  ]);

  protected readonly excludedFiles = new Set([
    '.DS_Store',
    'Thumbs.db',
    '.env',
    '.env.local',
  ]);

  async generateFileTree(
    directoryPath: string,
    rootPath: string,
    includeDotFolders: boolean,
    options: ProcessingOptions,
    level = 0,
  ): Promise<string> {
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      let tree = '';

      for (const entry of entries) {
        if (options.cancelToken?.isCancellationRequested) {
          break;
        }

        const fullPath = path.join(directoryPath, entry.name);

        if (this.shouldSkip(entry.name, includeDotFolders)) {
          continue;
        }

        const prefix = '  '.repeat(level);
        if (entry.isDirectory()) {
          tree += `${prefix}${entry.name}/\n`;
          const subtree = await this.generateFileTree(
            fullPath,
            rootPath,
            includeDotFolders,
            options,
            level + 1,
          );
          tree += subtree;
        } else {
          tree += `${prefix}${entry.name}\n`;
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
            combinedContent += `\n// File: ${relativePath}\n${content}\n`;
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
  ): Promise<number> {
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      let count = 0;

      for (const entry of entries) {
        if (options.cancelToken?.isCancellationRequested) {
          break;
        }

        if (this.shouldSkip(entry.name, false)) {
          continue;
        }

        if (entry.isDirectory()) {
          count += await this.countFiles(
            path.join(directoryPath, entry.name),
            options,
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
    const MAX_FILES = 1000;

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
              if (fileCount > MAX_FILES) {
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
      return fileCount > MAX_FILES;
    } catch (error) {
      return false;
    }
  }

  private shouldSkip(name: string, includeDotFolders: boolean): boolean {
    if (!includeDotFolders && name.startsWith('.')) {
      return true;
    }

    return this.excludedFolders.has(name) || this.excludedFiles.has(name);
  }
}
