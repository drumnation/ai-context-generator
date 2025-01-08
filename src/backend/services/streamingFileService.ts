import {
  IncrementalUpdateService,
  UpdateResult,
} from './incrementalUpdateService';
import { ProgressService } from './progressService';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { logger } from '../../shared/logger';

export interface FileInfo {
  size: number;
  mtime: Date;
}

export interface CachedFile {
  content: string;
  info: FileInfo;
}

export class StreamingFileService {
  private incrementalUpdateService: IncrementalUpdateService;
  private progressService: ProgressService;
  private fileCache: Map<string, CachedFile> = new Map();

  constructor() {
    this.progressService = new ProgressService();
    this.incrementalUpdateService = new IncrementalUpdateService(
      this.progressService,
      {
        include: ['**/*'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      },
    );
  }

  public async generateFileTree(directory: string): Promise<void> {
    try {
      const normalizedDir = path.normalize(directory);
      const changes = await this.incrementalUpdateService.detectChanges(
        normalizedDir,
        [],
      );
      await this.processChanges(changes, normalizedDir);
    } catch (error) {
      logger.error('Error generating file tree:', { error });
      throw error;
    }
  }

  private async processChanges(
    changes: UpdateResult,
    directory: string,
  ): Promise<void> {
    if (!changes || !changes.files || changes.files.length === 0) {
      return;
    }

    // Process all files
    await Promise.all(
      changes.files.map((file) => this.processFile(file, directory)),
    );
  }

  private async processFile(
    filePath: string,
    directory: string,
  ): Promise<void> {
    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(directory, filePath);

      const fileContent = await fsPromises.readFile(absolutePath, 'utf8');
      const stats = await fsPromises.stat(absolutePath);
      const fileInfo: FileInfo = {
        size: stats.size,
        mtime: stats.mtime,
      };

      // Store with both absolute and relative paths for better lookup
      const relativePath = path.relative(directory, absolutePath);
      this.fileCache.set(absolutePath, {
        content: fileContent,
        info: fileInfo,
      });
      this.fileCache.set(relativePath, {
        content: fileContent,
        info: fileInfo,
      });
    } catch (error) {
      logger.error('Error processing file:', { error, filePath });
    }
  }

  private hasNoChanges(changes: UpdateResult): boolean {
    return !changes || !changes.files || changes.files.length === 0;
  }

  public clearCache(): void {
    this.fileCache.clear();
  }

  public getFileContent(filePath: string): string | undefined {
    // Try both absolute and relative paths
    const content = this.fileCache.get(filePath)?.content;
    if (content) {
      return content;
    }

    // Try normalized path
    const normalizedPath = path.normalize(filePath);
    return this.fileCache.get(normalizedPath)?.content;
  }

  public getFileInfo(filePath: string): FileInfo | undefined {
    // Try both absolute and relative paths
    const info = this.fileCache.get(filePath)?.info;
    if (info) {
      return info;
    }

    // Try normalized path
    const normalizedPath = path.normalize(filePath);
    return this.fileCache.get(normalizedPath)?.info;
  }

  private getRelativePath(filePath: string): string {
    // If the path is already relative, return it as is
    if (!path.isAbsolute(filePath)) {
      return path.normalize(filePath);
    }

    // Try to find the directory this file belongs to by checking all cached files
    for (const [relativePath] of this.fileCache) {
      const dirPath = path.dirname(relativePath);
      const absoluteDirPath = path.resolve(dirPath);
      if (filePath.startsWith(absoluteDirPath)) {
        return path.relative(dirPath, filePath);
      }
    }

    // If no matching directory found, normalize the path
    return path.normalize(filePath);
  }
}
