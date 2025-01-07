import { PerformanceService } from '../performanceService';
import { FileService } from '../fileService';
import { logger } from '../../../shared/logger';
import mockVSCode from '../../../test/vscode.mock';

// Mock dependencies
jest.mock('../fileService');
jest.mock('../../../shared/logger');

// Mock VSCode
jest.mock('vscode', () => {
  const mockVSCode = jest.requireActual('../../../test/vscode.mock').default;
  return {
    ...mockVSCode,
    window: {
      ...mockVSCode.window,
      showWarningMessage: jest.fn(),
    },
  };
});

// Mock process.memoryUsage
const mockMemoryUsage: NodeJS.MemoryUsage = {
  heapTotal: 100 * 1024 * 1024, // 100MB
  heapUsed: 50 * 1024 * 1024, // 50MB
  external: 10 * 1024 * 1024, // 10MB
  arrayBuffers: 5 * 1024 * 1024, // 5MB
  rss: 200 * 1024 * 1024, // 200MB
};

describe('PerformanceService', () => {
  let performanceService: PerformanceService;
  let mockFileService: jest.Mocked<FileService>;
  let mockShowWarningMessage: jest.Mock;
  let originalMemoryUsage: NodeJS.MemoryUsageFn;

  beforeEach(() => {
    // Store original memoryUsage function
    originalMemoryUsage = process.memoryUsage;
    // Mock process.memoryUsage
    process.memoryUsage = jest
      .fn()
      .mockReturnValue(mockMemoryUsage) as unknown as NodeJS.MemoryUsageFn;

    // Reset mocks
    mockFileService = new FileService() as jest.Mocked<FileService>;
    mockShowWarningMessage = jest.fn();
    mockVSCode.window.showWarningMessage.mockImplementation(
      mockShowWarningMessage,
    );

    performanceService = new PerformanceService(mockFileService);

    // Clear metrics before each test
    performanceService.clearMetrics();
  });

  afterEach(() => {
    // Restore original memoryUsage function
    process.memoryUsage = originalMemoryUsage;
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
      expect(metric?.memoryBefore).toEqual(mockMemoryUsage);
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

    it('should show warning for high memory usage', () => {
      const operation = 'highMemoryOperation';
      const highMemoryUsage: NodeJS.MemoryUsage = {
        ...mockMemoryUsage,
        heapUsed: 200 * 1024 * 1024, // 200MB
      };

      const mockMemoryUsageFn = process.memoryUsage as unknown as jest.Mock;
      mockMemoryUsageFn
        .mockReturnValueOnce(mockMemoryUsage)
        .mockReturnValueOnce(highMemoryUsage);

      performanceService.startOperation(operation);
      performanceService.endOperation(operation);

      expect(mockShowWarningMessage).toHaveBeenCalledWith(
        'High memory usage detected in operation "highMemoryOperation". Consider optimizing the operation.',
      );
    });

    it('should not show warning for normal memory usage', () => {
      const operation = 'normalMemoryOperation';

      performanceService.startOperation(operation);
      performanceService.endOperation(operation);

      expect(mockShowWarningMessage).not.toHaveBeenCalled();
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
      );
      expect(mockFileService.combineFiles).toHaveBeenCalledWith(
        directoryPath,
        directoryPath,
        false,
      );
    });

    it('should handle errors during directory scanning', async () => {
      const directoryPath = '/test/path';
      const error = new Error('Test error');

      mockFileService.generateFileTree.mockRejectedValueOnce(error);

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
});
