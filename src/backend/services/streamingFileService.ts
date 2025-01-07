import * as path from 'path';
import * as fs from 'fs/promises';
import { Readable } from 'stream';
import { FileService } from './fileService';
import { logger } from '../../shared/logger';
import { ProcessingOptions } from './queueService';
import { CacheService } from './cacheService';

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

export class StreamingFileService extends FileService {
  private activeStreams: Map<string, FileStream> = new Map();
  private readonly maxConcurrentStreams = 5;
  private readonly HIGH_MEMORY_THRESHOLD = 100 * 1024 * 1024; // 100MB
  private readonly CRITICAL_MEMORY_THRESHOLD = 200 * 1024 * 1024; // 200MB
  private totalStreamSize = 0;
  private lastGarbageCollection = Date.now();
  private readonly GC_INTERVAL = 30000; // 30 seconds
  private fileCache: CacheService<string>;

  constructor(maxCacheSize: number = 50 * 1024 * 1024) {
    // 50MB default cache size
    super();
    this.fileCache = new CacheService<string>(maxCacheSize);
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
    // Check cache first
    const cachedContent = this.fileCache.get(filePath);
    if (cachedContent !== undefined) {
      logger.info('Cache hit', { filePath });
      return cachedContent;
    }

    const stats = await fs.stat(filePath);
    const fileSize = stats.size;

    // Check memory before creating a new stream
    const { heapUsed } = this.getMemoryStats();
    if (heapUsed > this.HIGH_MEMORY_THRESHOLD) {
      await this.garbageCollect(true);
    }

    // Check if we already have a stream for this file
    const existingStream = this.activeStreams.get(filePath);
    if (existingStream) {
      existingStream.lastAccessed = Date.now();
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        existingStream.stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        existingStream.stream.on('end', () => {
          const content = Buffer.concat(chunks).toString('utf-8');
          resolve(content);
          this.cleanupStream(filePath);
          // Cache the content for future use
          this.fileCache.set(filePath, content, fileSize);
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

    // Check if we need to perform garbage collection before adding new stream
    if (this.shouldTriggerGC()) {
      await this.garbageCollect(true);
    }

    this.activeStreams.set(filePath, {
      stream,
      cleanup,
      lastAccessed: Date.now(),
      size: fileSize,
    });

    this.totalStreamSize += fileSize;

    // Check if we need to clean up old streams
    if (this.activeStreams.size > this.maxConcurrentStreams) {
      await this.cleanupOldestStream();
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf-8');
        resolve(content);
        this.cleanupStream(filePath);
        // Cache the content for future use
        this.fileCache.set(filePath, content, fileSize);
      });
      stream.on('error', (error) => {
        logger.error('Error reading file:', { error, filePath });
        reject(error);
        this.cleanupStream(filePath);
      });
    });
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
          await this.cleanupAllStreams();
          break;
        }

        if (this.isExcluded(entry.name, includeDotFolders)) {
          continue;
        }

        const fullPath = path.join(directoryPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);

        // Check memory status and perform GC if needed
        if (this.shouldTriggerGC()) {
          await this.garbageCollect();
        }

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
      }

      return combinedContent;
    } catch (error) {
      await this.cleanupAllStreams();
      logger.error('Error combining files:', { error, directoryPath });
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

  // For testing
  getCacheStats() {
    return this.fileCache.getStats();
  }
}
