import { PerformanceService } from '../performanceService';
import { FileService } from '../fileService';
import { ProcessingOptions } from '../queueService';
import { logger } from '../../../shared/logger';

jest.mock('../fileService');
jest.mock('../../../shared/logger');

describe('PerformanceService', () => {
  let performanceService: PerformanceService;
  let mockFileService: jest.Mocked<FileService>;

  const defaultOptions: ProcessingOptions = {
    chunkSize: 50,
    delayBetweenChunks: 10,
  };

  beforeEach(() => {
    mockFileService = {
      generateFileTree: jest.fn(),
      combineFiles: jest.fn(),
      countFiles: jest.fn(),
      listDirectory: jest.fn(),
      readFile: jest.fn(),
    } as unknown as jest.Mocked<FileService>;

    performanceService = new PerformanceService(mockFileService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Operation Tracking', () => {
    it('should track start and end of an operation', () => {
      const operation = 'testOperation';

      performanceService.startOperation(operation);
      const metrics = performanceService.getMetrics();
      const metric = metrics.get(operation);

      expect(metric).toBeDefined();
      expect(metric?.startTime).toBeDefined();
      expect(metric?.memoryBefore).toBeDefined();
      expect(metric?.endTime).toBeUndefined();
      expect(metric?.memoryAfter).toBeUndefined();

      performanceService.endOperation(operation);
      const updatedMetric = performanceService.getMetrics().get(operation);

      expect(updatedMetric?.endTime).toBeDefined();
      expect(updatedMetric?.memoryAfter).toBeDefined();
      expect(logger.info).toHaveBeenCalledTimes(2);
    });

    it('should handle ending non-existent operation gracefully', () => {
      performanceService.endOperation('nonExistentOperation');
      expect(logger.warn).toHaveBeenCalledWith(
        'No start metric found for operation: nonExistentOperation',
      );
    });
  });

  describe('Metrics Management', () => {
    it('should clear metrics', () => {
      performanceService.startOperation('operation1');
      performanceService.startOperation('operation2');

      expect(performanceService.getMetrics().size).toBe(2);

      performanceService.clearMetrics();
      expect(performanceService.getMetrics().size).toBe(0);
    });

    it('should return a copy of metrics', () => {
      performanceService.startOperation('operation1');
      const metrics = performanceService.getMetrics();

      // Modify the returned map
      metrics.delete('operation1');

      // Original metrics should still contain the operation
      expect(performanceService.getMetrics().has('operation1')).toBe(true);
    });
  });

  describe('Directory Scanning Profile', () => {
    it('should profile directory scanning operations', async () => {
      const directoryPath = '/test/path';

      await performanceService.profileDirectoryScanning(directoryPath);

      // Verify all operations were tracked
      const metrics = performanceService.getMetrics();
      expect(metrics.has('directoryScanning')).toBe(true);
      expect(metrics.has('generateFileTree')).toBe(true);
      expect(metrics.has('combineFiles')).toBe(true);

      // Verify FileService methods were called with correct arguments
      expect(mockFileService.generateFileTree).toHaveBeenCalledWith(
        directoryPath,
        directoryPath,
        false,
        defaultOptions,
      );
      expect(mockFileService.combineFiles).toHaveBeenCalledWith(
        directoryPath,
        directoryPath,
        false,
        defaultOptions,
      );
    });

    it('should handle errors during directory scanning', async () => {
      const directoryPath = '/test/path';
      const error = new Error('Test error');

      mockFileService.generateFileTree.mockRejectedValue(error);

      await expect(
        performanceService.profileDirectoryScanning(directoryPath),
      ).rejects.toThrow('Test error');

      // Verify operations were properly ended even with error
      const metrics = performanceService.getMetrics();
      const directoryScanningMetric = metrics.get('directoryScanning');
      expect(directoryScanningMetric?.endTime).toBeDefined();

      // Since the error occurs during generateFileTree, only the main operation should be ended
      expect(metrics.has('generateFileTree')).toBe(true);
      const generateFileTreeMetric = metrics.get('generateFileTree');
      expect(generateFileTreeMetric?.startTime).toBeDefined();
      expect(generateFileTreeMetric?.endTime).toBeDefined();

      // combineFiles should not have been started
      expect(metrics.has('combineFiles')).toBe(false);
    });
  });

  describe('Directory Scanning Measurement', () => {
    it('should measure directory scanning operations', async () => {
      const directoryPath = '/test/path';
      const rootPath = '/test/path';
      const includeDotFolders = false;

      const result = await performanceService.measureDirectoryScanning(
        directoryPath,
        rootPath,
        includeDotFolders,
      );

      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('memoryImpact');
      expect(result.memoryImpact).toHaveProperty('heapUsedDiff');
      expect(result.memoryImpact).toHaveProperty('heapTotalDiff');
      expect(result).toHaveProperty('timestamp');

      expect(mockFileService.generateFileTree).toHaveBeenCalledWith(
        directoryPath,
        rootPath,
        includeDotFolders,
        defaultOptions,
      );
      expect(mockFileService.combineFiles).toHaveBeenCalledWith(
        rootPath,
        directoryPath,
        includeDotFolders,
        defaultOptions,
      );
    });

    it('should handle errors during directory scanning measurement', async () => {
      const directoryPath = '/test/path';
      const rootPath = '/test/path';
      const includeDotFolders = false;
      const error = new Error('Test error');

      mockFileService.generateFileTree.mockRejectedValue(error);

      await expect(
        performanceService.measureDirectoryScanning(
          directoryPath,
          rootPath,
          includeDotFolders,
        ),
      ).rejects.toThrow('Test error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error during directory scanning:',
        {
          error,
        },
      );
    });
  });
});
