import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { ProgressService } from './progressService';
import { ProcessingOptions } from './queueService';
import { logger } from '../../shared/logger';

export interface UpdateResult {
  files: string[];
  added: string[];
  removed: string[];
  unchanged: string[];
}

export interface FilePatterns {
  include: string[];
  exclude: string[];
}

export class IncrementalUpdateService {
  constructor(
    private progressService: ProgressService,
    private patterns: FilePatterns,
  ) {}

  async detectChanges(
    directoryPath: string,
    previousFiles: string[],
    _options?: ProcessingOptions,
  ): Promise<UpdateResult> {
    const taskId = `detect-changes-${Date.now()}`;
    return this.progressService.withProgress(
      taskId,
      {
        title: 'Reading files',
        cancellable: true,
      },
      async (progress, token) => {
        const result: UpdateResult = {
          files: [],
          added: [],
          removed: [],
          unchanged: [],
        };

        try {
          if (token?.isCancellationRequested) {
            return result;
          }

          // Get current files
          const currentFiles = await this.getAllFiles(directoryPath);
          progress.report({ message: 'Processing files...', increment: 30 });

          // Filter files based on patterns
          const filteredCurrentFiles = currentFiles.filter((filePath) =>
            this.shouldIncludeFile(filePath, directoryPath),
          );

          // Normalize paths for comparison
          const normalizedPreviousFiles = previousFiles.map((f) =>
            path.normalize(f),
          );
          const normalizedCurrentFiles = filteredCurrentFiles.map((f) =>
            path.normalize(f),
          );

          progress.report({ message: 'Analyzing changes...', increment: 40 });

          // Determine added, removed, and unchanged files
          result.files = normalizedCurrentFiles;
          result.added = normalizedCurrentFiles.filter(
            (file) => !normalizedPreviousFiles.includes(file),
          );
          result.removed = normalizedPreviousFiles.filter(
            (file) => !normalizedCurrentFiles.includes(file),
          );
          result.unchanged = normalizedCurrentFiles.filter((file) =>
            normalizedPreviousFiles.includes(file),
          );

          progress.report({ message: 'Completed', increment: 30 });
          return result;
        } catch (error) {
          logger.error('Error reading files:', { error });
          throw error;
        }
      },
    );
  }

  async getAllFiles(
    directoryPath: string,
    _includeDotFiles: boolean = true,
  ): Promise<string[]> {
    const files: string[] = [];
    const normalizedDirPath = path.normalize(directoryPath);

    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await fsPromises.readdir(dir, { withFileTypes: true });
      } catch (error) {
        logger.error('Error reading directory:', { error, dir });
        throw error;
      }

      await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(dir, entry.name);
          try {
            if (entry.isDirectory()) {
              await walk(fullPath);
            } else if (entry.isFile()) {
              files.push(path.normalize(fullPath));
            }
          } catch (error) {
            // Only log errors for individual files, don't fail the entire walk
            logger.error('Error processing file:', { error, fullPath });
          }
        }),
      );
    };

    await walk(normalizedDirPath);
    return files;
  }

  private shouldIncludeFile(filePath: string, directoryPath: string): boolean {
    // Get path relative to the directory being scanned
    const relativePath = path
      .relative(directoryPath, filePath)
      .replace(/\\/g, '/');

    // If the path starts with .., it's outside the directory
    if (relativePath.startsWith('..')) {
      return false;
    }

    // First check if path matches any exclude pattern
    const isExcluded = this.patterns.exclude.some((pattern) =>
      this.matchGlobPattern(relativePath, pattern),
    );

    if (isExcluded) {
      return false;
    }

    // If no include patterns, include everything not excluded
    if (!this.patterns.include || this.patterns.include.length === 0) {
      return true;
    }

    // Then check if path matches any include pattern
    return this.patterns.include.some((pattern) =>
      this.matchGlobPattern(relativePath, pattern),
    );
  }

  private matchGlobPattern(filePath: string, pattern: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');

    // Convert glob pattern to regex
    const regexPattern = normalizedPattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*') // ** matches any characters including /
      .replace(/\*/g, '[^/]*') // * matches any characters except /
      .replace(/\?/g, '[^/]')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\{/g, '(')
      .replace(/\}/g, ')')
      .replace(/,/g, '|');

    try {
      const regex = new RegExp(`^${regexPattern}$`, 'i'); // Case-insensitive matching
      return regex.test(normalizedPath);
    } catch (error) {
      logger.error('Invalid glob pattern:', { pattern, error });
      return false;
    }
  }
}
