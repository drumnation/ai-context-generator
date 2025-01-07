import { FileMetadata } from './streamingFileService';
import { logger } from '../../shared/logger';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { ProgressService } from './progressService';
import { ProcessingOptions } from './queueService';

export interface UpdateResult {
  changedFiles: string[];
  deletedFiles: string[];
  newFiles: string[];
}

export interface FileState {
  metadata: FileMetadata;
  lastProcessed: number;
}

export class IncrementalUpdateService {
  private fileStates: Map<string, FileState> = new Map();
  private readonly stateValidityDuration = 24 * 60 * 60 * 1000; // 24 hours
  private readonly progressService: ProgressService;

  constructor(progressService?: ProgressService) {
    this.progressService = progressService || new ProgressService();
  }

  async detectChanges(
    directoryPath: string,
    previousFiles: string[],
    options?: ProcessingOptions,
  ): Promise<UpdateResult> {
    const taskId = `detect-changes-${Date.now()}`;
    return this.progressService.withProgress(
      taskId,
      {
        title: 'Detecting file changes',
        cancellable: true,
      },
      async (progress, token) => {
        const result: UpdateResult = {
          changedFiles: [],
          deletedFiles: [],
          newFiles: [],
        };

        try {
          if (token?.isCancellationRequested) {
            return result;
          }

          // Get current files in directory
          const currentFiles = await this.getAllFiles(directoryPath);
          const currentFilePaths = new Set(currentFiles);
          const previousFilePaths = new Set(previousFiles);

          progress.report({
            message: 'Checking for deleted files...',
            increment: 20,
          });

          // Find deleted files and remove their states
          result.deletedFiles = previousFiles.filter((file) => {
            const deleted = !currentFilePaths.has(file);
            if (deleted) {
              this.fileStates.delete(file);
            }
            return deleted;
          });

          if (token?.isCancellationRequested) {
            return result;
          }

          progress.report({ message: 'Processing files...', increment: 30 });

          // Process files in chunks if specified
          const chunkSize = options?.chunkSize || currentFiles.length;
          const chunks = [];
          for (let i = 0; i < currentFiles.length; i += chunkSize) {
            chunks.push(currentFiles.slice(i, i + chunkSize));
          }

          // Process each chunk
          for (const [index, chunk] of chunks.entries()) {
            if (token?.isCancellationRequested) {
              return result;
            }

            progress.report({
              message: `Processing chunk ${index + 1}/${chunks.length}...`,
              increment: 40 / chunks.length,
            });

            await Promise.all(
              chunk.map(async (filePath) => {
                if (!previousFilePaths.has(filePath)) {
                  // New file - initialize its state without marking as changed
                  await this.initializeFileState(filePath);
                  result.newFiles.push(filePath);
                  return;
                }

                // Check if existing file changed
                const hasChanged = await this.checkFileChanged(filePath);
                if (hasChanged) {
                  result.changedFiles.push(filePath);
                }
              }),
            );

            // Add delay between chunks if specified
            if (options?.delayBetweenChunks && index < chunks.length - 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, options.delayBetweenChunks),
              );
            }
          }

          progress.report({ message: 'Finalizing...', increment: 10 });

          logger.info('Detected file changes', {
            changed: result.changedFiles.length,
            deleted: result.deletedFiles.length,
            new: result.newFiles.length,
          });

          return result;
        } catch (error: unknown) {
          logger.error('Error detecting changes:', { error, directoryPath });
          // Convert unknown error to Error instance
          if (error instanceof Error) {
            throw error;
          } else {
            throw new Error('Failed to detect changes: ' + String(error));
          }
        }
      },
    );
  }

  async getAllFiles(
    directoryPath: string,
    includeDotFiles: boolean = true,
  ): Promise<string[]> {
    const files: string[] = [];

    async function walk(dir: string) {
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip dot files/folders if not included
        if (!includeDotFiles && entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }

    await walk(directoryPath);
    return files.sort(); // Sort for consistent ordering
  }

  private async initializeFileState(filePath: string): Promise<void> {
    try {
      const stats = await fsPromises.stat(filePath);
      const metadata: FileMetadata = {
        mtime: stats.mtime,
        size: stats.size,
      };
      this.updateFileState(filePath, metadata);
    } catch (error) {
      logger.error('Error initializing file state:', { error, filePath });
    }
  }

  private async checkFileChanged(filePath: string): Promise<boolean> {
    try {
      const stats = await fsPromises.stat(filePath);
      const currentMetadata: FileMetadata = {
        mtime: stats.mtime,
        size: stats.size,
      };

      const state = this.fileStates.get(filePath);
      if (!state) {
        // If no state exists for a known file, consider it changed
        this.updateFileState(filePath, currentMetadata);
        return true;
      }

      // Check if state is too old
      if (Date.now() - state.lastProcessed > this.stateValidityDuration) {
        this.updateFileState(filePath, currentMetadata);
        return true;
      }

      // Check if file has changed
      const hasChanged =
        currentMetadata.mtime.getTime() !== state.metadata.mtime.getTime() ||
        currentMetadata.size !== state.metadata.size;

      if (hasChanged) {
        this.updateFileState(filePath, currentMetadata);
      }

      return hasChanged;
    } catch (error: unknown) {
      logger.error('Error checking file changes:', { error, filePath });
      // Remove state for non-existent files
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        this.fileStates.delete(filePath);
      }
      return true; // Assume changed on error
    }
  }

  private updateFileState(filePath: string, metadata: FileMetadata): void {
    this.fileStates.set(filePath, {
      metadata,
      lastProcessed: Date.now(),
    });
  }

  clearStates(): void {
    this.fileStates.clear();
  }

  getFileState(filePath: string): FileState | undefined {
    return this.fileStates.get(filePath);
  }
}
