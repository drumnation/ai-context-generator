import * as vscode from 'vscode';
import { logger } from '../../shared/logger';
import { performance } from 'perf_hooks';
import { FileService } from './fileService';

interface OperationMetrics {
  startTime: number;
  endTime?: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter?: NodeJS.MemoryUsage;
  operation: string;
}

export class PerformanceService {
  private metrics: Map<string, OperationMetrics> = new Map();
  private readonly fileService: FileService;

  constructor(fileService: FileService) {
    this.fileService = fileService;
  }

  startOperation(operation: string): void {
    const memoryUsage = process.memoryUsage();
    this.metrics.set(operation, {
      startTime: performance.now(),
      memoryBefore: memoryUsage,
      operation,
    });
    logger.info(`Starting operation: ${operation}`, {
      memoryBefore: memoryUsage,
      timestamp: new Date().toISOString(),
    });
  }

  endOperation(operation: string): void {
    const metric = this.metrics.get(operation);
    if (!metric) {
      logger.warn(`No start metric found for operation: ${operation}`);
      return;
    }

    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();
    metric.endTime = endTime;
    metric.memoryAfter = memoryAfter;

    const duration = endTime - metric.startTime;
    const heapDiff = {
      used: memoryAfter.heapUsed - metric.memoryBefore.heapUsed,
      total: memoryAfter.heapTotal - metric.memoryBefore.heapTotal,
    };

    logger.info(`Operation completed: ${operation}`, {
      duration: `${duration.toFixed(2)}ms`,
      memoryImpact: {
        heapUsedDiff: `${(heapDiff.used / 1024 / 1024).toFixed(2)}MB`,
        heapTotalDiff: `${(heapDiff.total / 1024 / 1024).toFixed(2)}MB`,
      },
      timestamp: new Date().toISOString(),
    });

    // Show warning if memory usage is high
    if (heapDiff.used > 100 * 1024 * 1024) {
      // Warning if heap usage increased by more than 100MB
      vscode.window.showWarningMessage(
        `High memory usage detected in operation "${operation}". Consider optimizing the operation.`,
      );
    }
  }

  async profileDirectoryScanning(directoryPath: string): Promise<void> {
    this.startOperation('directoryScanning');

    try {
      // Profile the file tree generation
      this.startOperation('generateFileTree');
      await this.fileService.generateFileTree(
        directoryPath,
        directoryPath,
        false,
      );
      this.endOperation('generateFileTree');

      // Profile the file combining operation
      this.startOperation('combineFiles');
      await this.fileService.combineFiles(directoryPath, directoryPath, false);
      this.endOperation('combineFiles');
    } finally {
      this.endOperation('directoryScanning');
    }
  }

  getMetrics(): Map<string, OperationMetrics> {
    return new Map(this.metrics);
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}
