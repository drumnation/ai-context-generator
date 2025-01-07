import * as path from 'path';
import * as fsP from 'fs/promises';
import * as fs from 'fs';
import { QueueService, ProcessingOptions } from './queueService';
import { logger } from '../../shared/logger';

interface FileItem {
  path: string;
  name: string;
  isDirectory: boolean;
  isLast: boolean;
  indent: string;
}

export class FileService {
  private queueService: QueueService;

  constructor() {
    this.queueService = new QueueService();
  }

  async generateFileTree(
    directoryPath: string,
    rootPath: string,
    includeDotFolders: boolean,
    options?: ProcessingOptions,
  ): Promise<string> {
    const tree: string[] = [path.basename(directoryPath)];
    const fileItems: FileItem[] = [];

    // First pass: collect all file items
    async function collectItems(
      dir: string,
      indent: string = '',
    ): Promise<void> {
      const files = await fsP.readdir(dir, { withFileTypes: true });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isLast = i === files.length - 1;

        if (
          file.isDirectory() &&
          (includeDotFolders ||
            (!file.name.startsWith('.') &&
              ![
                'node_modules',
                'dist',
                'build',
                'app/build',
                'gradle',
                '.gradle',
                '.idea',
                'android/.gradle',
                '.m2',
                '.mvn',
              ].includes(file.name)))
        ) {
          fileItems.push({
            path: path.join(dir, file.name),
            name: file.name,
            isDirectory: true,
            isLast,
            indent,
          });
          await collectItems(
            path.join(dir, file.name),
            indent + (isLast ? '    ' : '│   '),
          );
        } else if (
          file.isFile() &&
          !file.name.match(/\.(jpg|jpeg|png|gif|bmp|tiff|svg|lock|key)$/) &&
          file.name !== 'package-lock.json'
        ) {
          fileItems.push({
            path: path.join(dir, file.name),
            name: file.name,
            isDirectory: false,
            isLast,
            indent,
          });
        }
      }
    }

    await collectItems(directoryPath);

    // Process items in chunks
    if (options) {
      await this.queueService.processChunked(
        fileItems,
        async (item) => {
          const prefix = item.isLast ? '└── ' : '├── ';
          tree.push(`${item.indent}${prefix}${item.name}`);
          return true;
        },
        options,
      );
    } else {
      // Fallback to synchronous processing if no options provided
      fileItems.forEach((item) => {
        const prefix = item.isLast ? '└── ' : '├── ';
        tree.push(`${item.indent}${prefix}${item.name}`);
      });
    }

    return tree.join('\n');
  }

  async combineFiles(
    rootPath: string,
    directoryPath: string,
    includeDotFolders: boolean,
    options?: ProcessingOptions,
  ): Promise<string> {
    const fileItems: { path: string; relativePath: string }[] = [];
    let combinedContent = '';

    // First pass: collect all file paths
    async function collectFiles(dir: string): Promise<void> {
      const files = await fsP.readdir(dir, { withFileTypes: true });

      for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (
          file.isDirectory() &&
          (includeDotFolders ||
            (!file.name.startsWith('.') &&
              !['node_modules', 'dist'].includes(file.name)))
        ) {
          await collectFiles(fullPath);
        } else if (
          file.isFile() &&
          !file.name.match(/\.(jpg|jpeg|png|gif|bmp|tiff|svg|lock|key)$/) &&
          file.name !== 'package-lock.json'
        ) {
          fileItems.push({
            path: fullPath,
            relativePath: path.relative(rootPath, fullPath),
          });
        }
      }
    }

    await collectFiles(directoryPath);

    // Process files in chunks
    if (options) {
      const results = await this.queueService.processChunked(
        fileItems,
        async (item) => {
          try {
            const content = await fsP.readFile(item.path, 'utf-8');
            const fileExtension = path.extname(item.path).substring(1);
            return `\n\n# ./${item.relativePath}\n\n\`\`\`${fileExtension}\n${content}\n\`\`\`\n`;
          } catch (error) {
            logger.error(`Error reading file ${item.path}:`, { error });
            return '';
          }
        },
        options,
      );
      combinedContent = results.join('');
    } else {
      // Fallback to synchronous processing
      for (const item of fileItems) {
        try {
          const content = await fsP.readFile(item.path, 'utf-8');
          const fileExtension = path.extname(item.path).substring(1);
          combinedContent += `\n\n# ./${item.relativePath}\n\n\`\`\`${fileExtension}\n${content}\n\`\`\`\n`;
        } catch (error) {
          logger.error(`Error reading file ${item.path}:`, { error });
        }
      }
    }

    return combinedContent;
  }

  isLargeDirectory(dirPath: string): boolean {
    let fileCount = 0;
    const MAX_FILES = 1000;

    function countFiles(dir: string): void {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          try {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
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
}
