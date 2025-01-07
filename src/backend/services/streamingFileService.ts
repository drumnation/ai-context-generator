import * as path from 'path';
import * as fsPromises from 'fs/promises';
import { Stats } from 'fs';
import { Readable } from 'stream';
import { FileService } from './fileService';
import { logger } from '../../shared/logger';
import { ProcessingOptions } from './queueService';
import { CacheService } from './cacheService';
import * as fs from 'fs';

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

interface ProcessingResult {
  content: string;
  path: string;
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

  constructor(
    maxCacheSize: number = 50 * 1024 * 1024,
    maxParallelOps: number = 4,
  ) {
    super();
    this.fileCache = new CacheService<string>(maxCacheSize);
    this.maxParallelOperations = maxParallelOps;
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
    try {
      const stream = fs.createReadStream(filePath, {
        encoding: 'utf8',
        highWaterMark: 64 * 1024, // 64KB chunks
      });

      let content = '';
      for await (const chunk of stream) {
        content += chunk;
      }

      return content;
    } catch (error) {
      logger.error('Error reading file:', { error, filePath });
      throw error;
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

  // Override the base class generateFileTree method with an optimized version
  async generateFileTree(
    directoryPath: string,
    rootPath: string,
    includeDotFolders: boolean,
    options: ProcessingOptions,
    level = 0,
  ): Promise<string> {
    try {
      // Check cache first
      const cachedTree = this.directoryCache.get(directoryPath);
      if (
        cachedTree &&
        Date.now() - cachedTree.timestamp < this.TREE_CACHE_TTL &&
        cachedTree.includeDotFolders === includeDotFolders &&
        !(await this.shouldInvalidateCache(directoryPath, cachedTree))
      ) {
        logger.info('File tree cache hit', { directoryPath });
        // Return cached result immediately without any processing
        return this.formatDirectoryEntries(cachedTree.entries, level);
      }

      // Get directory entries
      const entries = await fsPromises.readdir(directoryPath, {
        withFileTypes: true,
      });

      // Process entries in parallel chunks for better performance
      const chunkSize = Math.ceil(entries.length / this.maxParallelOperations);
      const chunks = Array.from(
        { length: Math.ceil(entries.length / chunkSize) },
        (_, i) => entries.slice(i * chunkSize, (i + 1) * chunkSize),
      );

      const processedChunks = await Promise.all(
        chunks.map(async (chunk) => {
          const results: DirectoryEntry[] = [];
          for (const entry of chunk) {
            if (options.cancelToken?.isCancellationRequested) {
              break;
            }

            if (this.shouldSkip(entry.name, includeDotFolders)) {
              continue;
            }

            const fullPath = path.join(directoryPath, entry.name);
            let stats: Stats | null = null;
            try {
              stats = await fsPromises.stat(fullPath);
            } catch (error) {
              continue; // Skip entries we can't stat
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
              // Check cache for subdirectory
              const subCachedTree = this.directoryCache.get(fullPath);
              if (
                subCachedTree &&
                Date.now() - subCachedTree.timestamp < this.TREE_CACHE_TTL &&
                !(await this.shouldInvalidateCache(fullPath, subCachedTree))
              ) {
                logger.info('Subdirectory cache hit', { path: fullPath });
                dirEntry.children = subCachedTree.entries;
              } else {
                // Recursively process subdirectories
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
            }

            results.push(dirEntry);
          }
          return results;
        }),
      );

      const allEntries = processedChunks
        .flat()
        .sort((a, b) => a.name.localeCompare(b.name));

      // Cache the results with a timestamp
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

  // Override the existing combineFiles method to use the optimized tree
  async combineFiles(
    rootPath: string,
    directoryPath: string,
    includeDotFolders: boolean,
    options: ProcessingOptions,
  ): Promise<string> {
    try {
      // Clean up expired cache entries
      await this.cleanupDirectoryCache();

      // Build or get cached directory tree
      const tree = await this.generateFileTree(
        directoryPath,
        rootPath,
        includeDotFolders,
        options,
      );

      // Process tree entries in parallel
      const entries = this.parseTreeToEntries(tree, 0, directoryPath);
      const processEntry = async (
        entry: DirectoryEntry,
      ): Promise<ProcessingResult> => {
        if (options.cancelToken?.isCancellationRequested) {
          return { content: '', path: entry.path };
        }

        try {
          if (!entry.path) {
            throw new Error('Invalid entry path');
          }

          if (entry.isDirectory && entry.children) {
            // Process directory entries in chunks to manage memory
            const chunkSize = 5; // Process 5 files at a time
            const chunks = Array.from(
              { length: Math.ceil(entry.children.length / chunkSize) },
              (_, i) =>
                entry.children!.slice(i * chunkSize, (i + 1) * chunkSize),
            );

            let content = '';
            for (const chunk of chunks) {
              if (options.cancelToken?.isCancellationRequested) {
                break;
              }

              const chunkResults = await Promise.all(chunk.map(processEntry));
              content += chunkResults
                .map((r) => r.content)
                .filter(Boolean)
                .join('');

              // Force garbage collection after each chunk
              await this.cleanupDirectoryCache();
            }

            return {
              content: content
                ? `\n// Directory: ${entry.name}\n${content}`
                : '',
              path: entry.path,
            };
          } else {
            // For files, use streaming to minimize memory usage
            const content = await this.readFileWithStream(entry.path);
            return {
              content: `\n// File: ${entry.name}\n${content}\n`,
              path: entry.path,
            };
          }
        } catch (error) {
          logger.error('Error processing entry:', {
            error,
            path: entry.path,
          });
          return {
            content: `\n// Error processing: ${entry.name}\n`,
            path: entry.path,
          };
        }
      };

      // Process root entries in chunks
      const chunkSize = 5; // Process 5 entries at a time
      const chunks = Array.from(
        { length: Math.ceil(entries.length / chunkSize) },
        (_, i) => entries.slice(i * chunkSize, (i + 1) * chunkSize),
      );

      let result = '';
      for (const chunk of chunks) {
        if (options.cancelToken?.isCancellationRequested) {
          break;
        }

        const chunkResults = await Promise.all(chunk.map(processEntry));
        result += chunkResults
          .sort((a, b) => a.path.localeCompare(b.path))
          .map((r) => r.content)
          .join('');

        // Force garbage collection after each chunk
        await this.cleanupDirectoryCache();
      }

      return result;
    } catch (error) {
      await this.cleanupAllStreams();
      logger.error('Error combining files:', { error, directoryPath });
      throw error;
    }
  }

  // For testing
  getCacheStats() {
    return this.fileCache.getStats();
  }
}
