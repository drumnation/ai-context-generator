import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { Stats } from 'fs';
import { Readable } from 'stream';
import { FileService } from './fileService';
import { logger } from '../../shared/logger';
import { ProcessingOptions } from './queueService';
import { CacheService } from './cacheService';
import { ProgressService } from './progressService';
import * as fs from 'fs';
import * as vscode from 'vscode';

interface FileStream {
  stream: Readable;
  cleanup: () => void;
  lastAccessed: number;
  size: number;
}

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  rss: number;
}

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: DirectoryEntry[];
  size?: number;
  lastModified?: number;
}

interface DirectoryCache {
  entries: DirectoryEntry[];
  timestamp: number;
  size: number;
  includeDotFolders: boolean;
}

export interface FileMetadata {
  mtime: Date;
  size: number;
  hash?: string;
}

interface FileCache {
  content: string;
  metadata: FileMetadata;
  lastAccessed: number;
}

export class StreamingFileService extends FileService {
  private activeStreams: Map<string, FileStream> = new Map();
  private readonly maxConcurrentStreams = 5;
  private readonly HIGH_MEMORY_THRESHOLD = 100 * 1024 * 1024; // 100MB
  private readonly CRITICAL_MEMORY_THRESHOLD = 200 * 1024 * 1024; // 200MB
  private maxParallelOperations: number = 4;
  private totalStreamSize = 0;
  private lastGarbageCollection = Date.now();
  private readonly GC_INTERVAL = 30000; // 30 seconds
  private readonly TREE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private fileCache: CacheService<string>;
  private directoryCache: Map<string, DirectoryCache> = new Map();
  private progressService: ProgressService;
  private fileMetadataCache: Map<string, FileMetadata> = new Map();
  private fileContentCache: Map<string, FileCache> = new Map();

  constructor(
    maxCacheSize: number = 50 * 1024 * 1024,
    maxParallelOps: number = 4,
    progressService?: ProgressService,
  ) {
    super();
    this.fileCache = new CacheService<string>(maxCacheSize);
    this.maxParallelOperations = maxParallelOps;
    this.progressService = progressService || new ProgressService();
  }

  private getMemoryStats(): MemoryStats {
    const { heapUsed, heapTotal, rss } = process.memoryUsage();
    return { heapUsed, heapTotal, rss };
  }

  private shouldTriggerGC(): boolean {
    const { heapUsed } = this.getMemoryStats();
    const timeSinceLastGC = Date.now() - this.lastGarbageCollection;
    return (
      heapUsed > this.HIGH_MEMORY_THRESHOLD ||
      timeSinceLastGC > this.GC_INTERVAL
    );
  }

  private async garbageCollect(force: boolean = false): Promise<void> {
    const { heapUsed } = this.getMemoryStats();

    if (!force && !this.shouldTriggerGC()) {
      return;
    }

    logger.info('Starting garbage collection', {
      heapUsed: this.formatBytes(heapUsed),
    });

    // Sort streams by last accessed time
    const streams = Array.from(this.activeStreams.entries()).sort(
      ([, a], [, b]) => a.lastAccessed - b.lastAccessed,
    );

    // If memory usage is critical, clean up more aggressively
    const cleanupCount =
      heapUsed > this.CRITICAL_MEMORY_THRESHOLD
        ? Math.ceil(streams.length * 0.5) // Clean up 50% of streams
        : Math.ceil(streams.length * 0.25); // Clean up 25% of streams

    for (let i = 0; i < cleanupCount && i < streams.length; i++) {
      const [filePath] = streams[i];
      await this.cleanupStream(filePath);
    }

    this.lastGarbageCollection = Date.now();
    const newHeapUsed = this.getMemoryStats().heapUsed;
    logger.info('Garbage collection completed', {
      freedMemory: this.formatBytes(heapUsed - newHeapUsed),
      remainingStreams: this.activeStreams.size,
    });
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)}${units[unitIndex]}`;
  }

  private async cleanupStream(filePath: string): Promise<void> {
    const stream = this.activeStreams.get(filePath);
    if (stream) {
      stream.cleanup();
      this.totalStreamSize -= stream.size;
      this.activeStreams.delete(filePath);
      logger.info('Cleaned up stream', {
        filePath,
        size: this.formatBytes(stream.size),
      });
    }
  }

  private async cleanupOldestStream(): Promise<void> {
    const [oldestPath] =
      Array.from(this.activeStreams.entries()).sort(
        ([, a], [, b]) => a.lastAccessed - b.lastAccessed,
      )[0] || [];

    if (oldestPath) {
      await this.cleanupStream(oldestPath);
    }
  }

  private async cleanupAllStreams(): Promise<void> {
    const streams = Array.from(this.activeStreams.keys());
    for (const filePath of streams) {
      await this.cleanupStream(filePath);
    }
  }

  private async readFileWithStream(filePath: string): Promise<string> {
    const taskId = `read_${filePath}`;
    return this.progressService.withProgress(
      taskId,
      {
        title: `Reading ${path.basename(filePath)}`,
        cancellable: true,
      },
      async (
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        token: vscode.CancellationToken,
      ) => {
        try {
          const stream = fs.createReadStream(filePath, {
            encoding: 'utf8',
            highWaterMark: 64 * 1024, // 64KB chunks
          });

          const stats = await fsPromises.stat(filePath);
          let bytesRead = 0;
          let content = '';

          for await (const chunk of stream) {
            if (token.isCancellationRequested) {
              stream.destroy();
              throw new Error('Operation cancelled');
            }

            content += chunk;
            bytesRead += Buffer.byteLength(chunk);

            this.progressService.updateProgress(taskId, {
              current: bytesRead,
              total: stats.size,
              message: `Read ${this.formatBytes(bytesRead)} of ${this.formatBytes(stats.size)}`,
            });
          }

          return content;
        } catch (error) {
          logger.error('Error reading file:', { error, filePath });
          throw error;
        }
      },
    );
  }

  private async getFileMetadata(filePath: string): Promise<FileMetadata> {
    try {
      const stats = await fsPromises.stat(filePath);
      return {
        mtime: stats.mtime,
        size: stats.size,
      };
    } catch (error) {
      logger.error('Error getting file metadata:', { error, filePath });
      throw error;
    }
  }

  private async hasFileChanged(filePath: string): Promise<boolean> {
    try {
      const currentMetadata = await this.getFileMetadata(filePath);
      const cachedMetadata = this.fileMetadataCache.get(filePath);

      if (!cachedMetadata) {
        return true;
      }

      return (
        currentMetadata.mtime.getTime() !== cachedMetadata.mtime.getTime() ||
        currentMetadata.size !== cachedMetadata.size
      );
    } catch (error) {
      logger.error('Error checking file changes:', { error, filePath });
      return true; // Assume changed on error
    }
  }

  private async updateFileCache(
    filePath: string,
    content: string,
  ): Promise<void> {
    try {
      const metadata = await this.getFileMetadata(filePath);
      this.fileMetadataCache.set(filePath, metadata);
      this.fileContentCache.set(filePath, {
        content,
        metadata,
        lastAccessed: Date.now(),
      });
    } catch (error) {
      logger.error('Error updating file cache:', { error, filePath });
      throw error;
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      // Check cache first
      const cached = this.fileContentCache.get(filePath);
      if (cached) {
        const hasChanged = await this.hasFileChanged(filePath);
        if (!hasChanged) {
          cached.lastAccessed = Date.now();
          return cached.content;
        }
      }

      // Read file and update cache
      const content = await this.readFileWithStream(filePath);
      await this.updateFileCache(filePath, content);
      return content;
    } catch (error) {
      logger.error('Error reading file:', { error, filePath });
      throw error;
    }
  }

  // Override the base class generateFileTree method with an optimized version
  async generateFileTree(
    directoryPath: string,
    rootPath: string,
    includeDotFolders: boolean,
    options: ProcessingOptions,
    level = 0,
  ): Promise<string> {
    const taskId = `tree_${directoryPath}`;
    return this.progressService.withProgress(
      taskId,
      {
        title: `Generating file tree for ${path.basename(directoryPath)}`,
        cancellable: true,
      },
      async (
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        token: vscode.CancellationToken,
      ) => {
        try {
          // Check current directory contents
          const currentEntries = await fsPromises.readdir(directoryPath, {
            withFileTypes: true,
          });

          // Check cache first
          const cachedTree = this.directoryCache.get(directoryPath);
          if (
            cachedTree &&
            Date.now() - cachedTree.timestamp < this.TREE_CACHE_TTL &&
            cachedTree.includeDotFolders === includeDotFolders
          ) {
            // Compare current entries with cached entries to detect changes
            const cachedNames = new Set(cachedTree.entries.map((e) => e.name));
            const currentNames = new Set(currentEntries.map((e) => e.name));

            // If any files were added or removed, invalidate cache
            const hasChanges =
              Array.from(currentNames).some((name) => !cachedNames.has(name)) ||
              Array.from(cachedNames).some((name) => !currentNames.has(name));

            if (!hasChanges) {
              this.progressService.updateProgress(taskId, {
                message: 'Using cached file tree',
                current: 100,
                total: 100,
              });
              return this.formatDirectoryEntries(cachedTree.entries, level);
            }
          }

          const validEntries = currentEntries.filter(
            (entry) => !this.shouldSkip(entry.name, includeDotFolders),
          );

          const chunkSize = Math.ceil(
            validEntries.length / this.maxParallelOperations,
          );
          const chunks = Array.from(
            { length: Math.ceil(validEntries.length / chunkSize) },
            (_, i) => validEntries.slice(i * chunkSize, (i + 1) * chunkSize),
          );

          let processedCount = 0;
          const processedChunks = await Promise.all(
            chunks.map(async (chunk) => {
              const results: DirectoryEntry[] = [];
              for (const entry of chunk) {
                if (token.isCancellationRequested) {
                  break;
                }

                const fullPath = path.join(directoryPath, entry.name);
                let stats: Stats | null = null;
                try {
                  stats = await fsPromises.stat(fullPath);
                } catch (error) {
                  continue;
                }

                const dirEntry: DirectoryEntry = {
                  name: entry.name,
                  path: fullPath,
                  isDirectory: entry.isDirectory(),
                  size: stats.size,
                  lastModified: stats.mtimeMs,
                  children: entry.isDirectory() ? [] : undefined,
                };

                if (dirEntry.isDirectory) {
                  const subTree = await this.generateFileTree(
                    fullPath,
                    rootPath,
                    includeDotFolders,
                    options,
                    level + 1,
                  );
                  if (subTree && dirEntry.children) {
                    const subEntries = this.parseTreeToEntries(
                      subTree,
                      level + 1,
                      fullPath,
                    );
                    dirEntry.children = subEntries;
                  }
                }

                results.push(dirEntry);
                processedCount++;

                this.progressService.updateProgress(taskId, {
                  current: processedCount,
                  total: validEntries.length,
                  message: `Processed ${processedCount} of ${validEntries.length} entries`,
                });
              }
              return results;
            }),
          );

          const allEntries = processedChunks
            .flat()
            .sort((a, b) => a.name.localeCompare(b.name));

          this.directoryCache.set(directoryPath, {
            entries: allEntries,
            timestamp: Date.now(),
            size: allEntries.reduce((sum, entry) => sum + (entry.size || 0), 0),
            includeDotFolders,
          });

          return this.formatDirectoryEntries(allEntries, level);
        } catch (error) {
          logger.error('Error generating file tree:', {
            error,
            directoryPath,
          });
          throw error;
        }
      },
    );
  }

  private formatDirectoryEntries(
    entries: DirectoryEntry[],
    level: number,
  ): string {
    let tree = '';
    const indent = '  '.repeat(level);

    for (const entry of entries) {
      if (entry.isDirectory) {
        tree += `${indent}${entry.name}/\n`;
        if (entry.children) {
          tree += this.formatDirectoryEntries(entry.children, level + 1);
        }
      } else {
        tree += `${indent}${entry.name}\n`;
      }
    }

    return tree;
  }

  private parseTreeToEntries(
    tree: string,
    parentLevel: number,
    basePath: string = '',
  ): DirectoryEntry[] {
    const entries: DirectoryEntry[] = [];
    const currentLevelEntries = new Map<string, DirectoryEntry>();
    const lines = tree.split('\n').filter(Boolean);

    for (const line of lines) {
      const match = line.match(/^(\s*)(.*)/);
      if (!match) {
        continue;
      }

      const [, indent, name] = match;
      const level = indent.length / 2;

      if (level === parentLevel) {
        const isDirectory = name.endsWith('/');
        const entryName = isDirectory ? name.slice(0, -1) : name;
        const fullPath = path.join(basePath, entryName);

        const entry: DirectoryEntry = {
          name: entryName,
          path: fullPath,
          isDirectory,
          children: isDirectory ? [] : undefined,
          size: 0,
          lastModified: Date.now(),
        };

        currentLevelEntries.set(entryName, entry);
        entries.push(entry);
      } else if (level > parentLevel) {
        // This is a child entry, find its parent
        const parentEntry = Array.from(currentLevelEntries.values()).find(
          (entry) => entry.isDirectory,
        );

        if (parentEntry?.children) {
          const childName = name.trim();
          const isDirectory = childName.endsWith('/');
          const entryName = isDirectory ? childName.slice(0, -1) : childName;
          const fullPath = path.join(parentEntry.path, entryName);

          parentEntry.children.push({
            name: entryName,
            path: fullPath,
            isDirectory,
            children: isDirectory ? [] : undefined,
            size: 0,
            lastModified: Date.now(),
          });
        }
      }
    }

    return entries;
  }

  private async shouldInvalidateCache(
    directoryPath: string,
    cachedTree: DirectoryCache,
  ): Promise<boolean> {
    try {
      const stats = await fsPromises.stat(directoryPath);
      // Check if the directory has been modified since the last cache
      if (stats.mtimeMs > cachedTree.timestamp) {
        return true;
      }

      // Also check if any files in the directory have been modified
      const entries = await fsPromises.readdir(directoryPath, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);
        try {
          const entryStats = await fsPromises.stat(fullPath);
          if (entryStats.mtimeMs > cachedTree.timestamp) {
            return true;
          }
        } catch (error) {
          // Skip entries we can't stat
          continue;
        }
      }

      return false;
    } catch (error) {
      return true; // If we can't check the stats, invalidate the cache
    }
  }

  private async cleanupDirectoryCache(): Promise<void> {
    const now = Date.now();
    for (const [path, cache] of this.directoryCache.entries()) {
      if (now - cache.timestamp > this.TREE_CACHE_TTL) {
        this.directoryCache.delete(path);
      }
    }
  }

  async combineFiles(
    rootPath: string,
    directoryPath: string,
    includeDotFolders: boolean,
    options: ProcessingOptions,
  ): Promise<string> {
    const taskId = `combine_${directoryPath}`;
    return this.progressService.withProgress(
      taskId,
      {
        title: `Combining files in ${path.basename(directoryPath)}`,
        cancellable: true,
      },
      async (progress, token) => {
        try {
          const tree = await this.generateFileTree(
            directoryPath,
            rootPath,
            includeDotFolders,
            options,
          );
          const entries = this.parseTreeToEntries(tree, 0, directoryPath);
          const files = this.flattenEntries(entries);

          let combinedContent = '';
          let processedFiles = 0;

          for (const file of files) {
            if (token.isCancellationRequested) {
              throw new Error('Operation cancelled');
            }

            const hasChanged = await this.hasFileChanged(file.path);
            const cached = this.fileContentCache.get(file.path);

            let content: string;
            if (!hasChanged && cached) {
              content = cached.content;
            } else {
              content = await this.readFile(file.path);
            }

            combinedContent += content + '\n';
            processedFiles++;

            this.progressService.updateProgress(taskId, {
              current: processedFiles,
              total: files.length,
              message: `Combined ${processedFiles} of ${files.length} files`,
            });
          }

          return combinedContent;
        } catch (error) {
          logger.error('Error combining files:', { error, directoryPath });
          throw error;
        }
      },
    );
  }

  private flattenEntries(entries: DirectoryEntry[]): { path: string }[] {
    const files: { path: string }[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory) {
        files.push({ path: entry.path });
      } else if (entry.children) {
        files.push(...this.flattenEntries(entry.children));
      }
    }
    return files;
  }

  // For testing
  getCacheStats() {
    return this.fileCache.getStats();
  }

  protected shouldSkip(name: string, includeDotFolders: boolean): boolean {
    // Always skip node_modules and dist directories
    if (name === 'node_modules' || name === 'dist') {
      return true;
    }

    // Skip dot folders/files unless explicitly included
    if (!includeDotFolders && (name.startsWith('.') || name === '.git')) {
      return true;
    }

    // Always skip .git directory regardless of includeDotFolders setting
    if (name === '.git') {
      return true;
    }

    return false;
  }
}
