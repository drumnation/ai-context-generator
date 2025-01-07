import * as path from 'path';
import * as fs from 'fs/promises';
import { Readable } from 'stream';
import { FileService } from './fileService';
import { logger } from '../../shared/logger';
import { ProcessingOptions } from './queueService';

interface FileStream {
  stream: Readable;
  cleanup: () => void;
}

export class StreamingFileService extends FileService {
  private activeStreams: Map<string, FileStream> = new Map();
  private readonly maxConcurrentStreams = 5;

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
          this.cleanupAllStreams();
          break;
        }

        if (this.isExcluded(entry.name, includeDotFolders)) {
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
            const content = await this.readFileWithStream(fullPath);
            combinedContent += `\n// File: ${relativePath}\n${content}\n`;
          } catch (error) {
            logger.error('Error reading file:', { error, filePath: fullPath });
            combinedContent += `\n// File: ${relativePath}\n\n`;
          }
        }

        // Cleanup streams if we've exceeded the limit
        if (this.activeStreams.size > this.maxConcurrentStreams) {
          await this.cleanupOldestStream();
        }
      }

      return combinedContent;
    } catch (error) {
      this.cleanupAllStreams();
      logger.error('Error combining files:', { error, directoryPath });
      throw error;
    }
  }

  private async readFileWithStream(filePath: string): Promise<string> {
    // Check if we already have a stream for this file
    const existingStream = this.activeStreams.get(filePath);
    if (existingStream) {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        existingStream.stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        existingStream.stream.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf-8'));
          this.cleanupStream(filePath);
        });
        existingStream.stream.on('error', (error) => {
          logger.error('Error reading file:', { error, filePath });
          reject(error);
          this.cleanupStream(filePath);
        });
      });
    }

    // Create a new stream
    const fileHandle = await fs.open(filePath, 'r');
    const stream = fileHandle.createReadStream();

    const cleanup = () => {
      stream.destroy();
      fileHandle.close().catch((error) => {
        logger.error('Error closing file handle:', { error, filePath });
      });
    };

    this.activeStreams.set(filePath, { stream, cleanup });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8'));
        this.cleanupStream(filePath);
      });
      stream.on('error', (error) => {
        logger.error('Error reading file:', { error, filePath });
        reject(error);
        this.cleanupStream(filePath);
      });
    });
  }

  private cleanupStream(filePath: string): void {
    const stream = this.activeStreams.get(filePath);
    if (stream) {
      stream.cleanup();
      this.activeStreams.delete(filePath);
    }
  }

  private async cleanupOldestStream(): Promise<void> {
    const [oldestPath] = this.activeStreams.keys();
    if (oldestPath) {
      this.cleanupStream(oldestPath);
    }
  }

  private cleanupAllStreams(): void {
    for (const [filePath] of this.activeStreams) {
      this.cleanupStream(filePath);
    }
  }

  // Override readFile to use streaming
  async readFile(filePath: string): Promise<string> {
    try {
      return await this.readFileWithStream(filePath);
    } catch (error) {
      logger.error('Error reading file:', { error, filePath });
      throw error;
    }
  }

  // Helper method to check if a file/directory should be excluded
  private isExcluded(name: string, includeDotFolders: boolean): boolean {
    if (!includeDotFolders && name.startsWith('.')) {
      return true;
    }

    return this.excludedFolders.has(name) || this.excludedFiles.has(name);
  }
}
