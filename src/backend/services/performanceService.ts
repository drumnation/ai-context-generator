import { performance } from 'perf_hooks';
import { logger } from '../../shared/logger';
import { FileService } from './fileService';
import { ProcessingOptions } from './queueService';
import * as vscode from 'vscode';

interface MemoryInfo {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

interface OperationMetrics {
  duration: string;
  memoryImpact: {
    heapUsedDiff: string;
    heapTotalDiff: string;
  };
  timestamp: string;
}

interface OperationStart {
  memoryBefore: MemoryInfo;
  timestamp: string;
}

interface DetailedMetric {
  startTime: number;
  endTime?: number;
  memoryBefore: MemoryInfo;
  memoryAfter?: MemoryInfo;
}

export class PerformanceService {
  private fileService: FileService;
  private metrics: Map<string, DetailedMetric> = new Map();
  private readonly HIGH_MEMORY_THRESHOLD = 100 * 1024 * 1024; // 100MB

  constructor(fileService: FileService) {
    this.fileService = fileService;
  }

  clearMetrics(): void {
    this.metrics.clear();
  }

  startOperation(operationName: string): void {
    const startTime = performance.now();
    const memoryBefore = this.getMemoryInfo();
    this.metrics.set(operationName, { startTime, memoryBefore });
    logger.info(`Starting operation: ${operationName}`, { memoryBefore });
  }

  endOperation(operationName: string): void {
    const metric = this.metrics.get(operationName);
    if (!metric) {
      logger.warn(`No start metric found for operation: ${operationName}`);
      return;
    }

    const endTime = performance.now();
    const memoryAfter = this.getMemoryInfo();
    this.metrics.set(operationName, { ...metric, endTime, memoryAfter });

    const memoryDiff = memoryAfter.heapUsed - metric.memoryBefore.heapUsed;
    if (memoryDiff > this.HIGH_MEMORY_THRESHOLD) {
      vscode.window.showWarningMessage(
        `High memory usage detected in operation "${operationName}". Consider optimizing the operation.`,
      );
    }

    logger.info(`Operation completed: ${operationName}`, {
      duration: `${(endTime - metric.startTime).toFixed(2)}ms`,
      memoryImpact: {
        heapUsedDiff: this.formatBytes(memoryDiff),
        heapTotalDiff: this.formatBytes(
          memoryAfter.heapTotal - metric.memoryBefore.heapTotal,
        ),
      },
    });
  }

  getMetrics(): Map<string, DetailedMetric> {
    return new Map(this.metrics);
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

  private getMemoryInfo(): MemoryInfo {
    const memoryUsage = process.memoryUsage();
    return {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers || 0,
    };
  }

  async profileDirectoryScanning(directoryPath: string): Promise<void> {
    this.startOperation('directoryScanning');
    this.startOperation('generateFileTree');

    const options: ProcessingOptions = {
      chunkSize: 50,
      delayBetweenChunks: 10,
    };

    try {
      await this.fileService.generateFileTree(
        directoryPath,
        directoryPath,
        false,
        options,
      );
      this.endOperation('generateFileTree');

      this.startOperation('combineFiles');
      await this.fileService.combineFiles(
        directoryPath,
        directoryPath,
        false,
        options,
      );
      this.endOperation('combineFiles');
    } catch (error) {
      this.endOperation('generateFileTree');
      logger.error('Error during directory scanning:', { error });
      throw error;
    } finally {
      this.endOperation('directoryScanning');
    }
  }

  async measureDirectoryScanning(
    directoryPath: string,
    rootPath: string,
    includeDotFolders: boolean,
  ): Promise<OperationMetrics> {
    const startInfo = this.logOperationStart('directoryScanning');
    const startTime = performance.now();

    const options: ProcessingOptions = {
      chunkSize: 50,
      delayBetweenChunks: 10,
    };

    try {
      await this.fileService.generateFileTree(
        directoryPath,
        rootPath,
        includeDotFolders,
        options,
      );
      await this.fileService.combineFiles(
        rootPath,
        directoryPath,
        includeDotFolders,
        options,
      );
    } catch (error) {
      logger.error('Error during directory scanning:', { error });
      throw error;
    }

    return this.logOperationEnd('directoryScanning', startInfo, startTime);
  }

  private logOperationStart(operationName: string): OperationStart {
    const memoryBefore = this.getMemoryInfo();
    const timestamp = new Date().toISOString();

    logger.info(`Starting operation: ${operationName}`, {
      memoryBefore,
      timestamp,
    });

    return { memoryBefore, timestamp };
  }

  private logOperationEnd(
    operationName: string,
    startInfo: OperationStart,
    startTime: number,
  ): OperationMetrics {
    const endTime = performance.now();
    const duration = `${(endTime - startTime).toFixed(2)}ms`;

    const memoryAfter = this.getMemoryInfo();
    const heapUsedDiff = this.formatBytes(
      memoryAfter.heapUsed - startInfo.memoryBefore.heapUsed,
    );
    const heapTotalDiff = this.formatBytes(
      memoryAfter.heapTotal - startInfo.memoryBefore.heapTotal,
    );

    const metrics = {
      duration,
      memoryImpact: { heapUsedDiff, heapTotalDiff },
      timestamp: new Date().toISOString(),
    };

    logger.info(`Operation completed: ${operationName}`, metrics);

    return metrics;
  }
}
