import { IncrementalUpdateService } from '../incrementalUpdateService';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
  },
}));

describe('IncrementalUpdateService', () => {
  let service: IncrementalUpdateService;
  let mockFiles: { [key: string]: { mtime: Date; size: number } };
  const testDir = '/test/dir';

  beforeEach(() => {
    service = new IncrementalUpdateService();
    mockFiles = {};

    // Reset mocks
    jest.clearAllMocks();

    // Mock file system functions
    (fsPromises.readdir as jest.Mock).mockImplementation(
      async (_dir: string) => {
        const files = Object.keys(mockFiles).map((filePath) => ({
          name: path.basename(filePath),
          isDirectory: () => false,
          isFile: () => true,
        }));
        return files;
      },
    );

    (fsPromises.stat as jest.Mock).mockImplementation(
      async (filePath: string) => {
        const fileData = mockFiles[filePath];
        if (!fileData) {
          throw new Error('File not found');
        }
        return {
          mtime: fileData.mtime,
          size: fileData.size,
          isDirectory: () => false,
        };
      },
    );
  });

  describe('detectChanges', () => {
    it('should detect new files', async () => {
      // Setup
      const file1 = path.join(testDir, 'file1.txt');
      mockFiles[file1] = { mtime: new Date(), size: 100 };

      // Test
      const result = await service.detectChanges(testDir, []);

      // Verify
      expect(result.newFiles).toContain(file1);
      expect(result.changedFiles).toHaveLength(0);
      expect(result.deletedFiles).toHaveLength(0);
    });

    it('should detect deleted files', async () => {
      // Setup
      const previousFiles = [path.join(testDir, 'deleted.txt')];
      mockFiles = {}; // Empty current directory

      // Test
      const result = await service.detectChanges(testDir, previousFiles);

      // Verify
      expect(result.deletedFiles).toContain(previousFiles[0]);
      expect(result.newFiles).toHaveLength(0);
      expect(result.changedFiles).toHaveLength(0);
    });

    it('should detect modified files', async () => {
      // Setup
      const file1 = path.join(testDir, 'file1.txt');
      mockFiles[file1] = { mtime: new Date(), size: 100 };

      // First pass to establish baseline
      await service.detectChanges(testDir, [file1]);

      // Modify file
      mockFiles[file1] = { mtime: new Date(Date.now() + 1000), size: 200 };

      // Test
      const result = await service.detectChanges(testDir, [file1]);

      // Verify
      expect(result.changedFiles).toContain(file1);
      expect(result.newFiles).toHaveLength(0);
      expect(result.deletedFiles).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      // Setup
      (fsPromises.readdir as jest.Mock).mockRejectedValue(
        new Error('Access denied'),
      );

      // Test & Verify
      await expect(service.detectChanges(testDir, [])).rejects.toThrow(
        'Access denied',
      );
    });
  });

  describe('file state management', () => {
    it('should clear file states', async () => {
      // Setup
      const file1 = path.join(testDir, 'file1.txt');
      mockFiles[file1] = { mtime: new Date(), size: 100 };
      await service.detectChanges(testDir, []);

      // Test
      service.clearStates();

      // Verify - next detection should treat file as new
      const result = await service.detectChanges(testDir, [file1]);
      expect(result.changedFiles).toContain(file1);
    });

    it('should handle state validity duration', async () => {
      // Setup
      const file1 = path.join(testDir, 'file1.txt');
      const initialTime = new Date();
      mockFiles[file1] = { mtime: initialTime, size: 100 };

      // First detection
      await service.detectChanges(testDir, [file1]);

      // Mock date to be after validity duration (24 hours)
      const futureTime = new Date(initialTime.getTime() + 25 * 60 * 60 * 1000);
      jest.spyOn(Date, 'now').mockImplementation(() => futureTime.getTime());

      // Test
      const result = await service.detectChanges(testDir, [file1]);

      // Verify - file should be treated as changed due to expired state
      expect(result.changedFiles).toContain(file1);
    });
  });

  describe('getAllFiles', () => {
    it('should return all files in directory', async () => {
      // Setup
      const files = [
        path.join(testDir, 'file1.txt'),
        path.join(testDir, 'file2.txt'),
      ];
      files.forEach((file) => {
        mockFiles[file] = { mtime: new Date(), size: 100 };
      });

      // Test
      const result = await service.getAllFiles(testDir);

      // Verify
      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining(files));
    });

    it('should handle empty directories', async () => {
      // Setup
      mockFiles = {};

      // Test
      const result = await service.getAllFiles(testDir);

      // Verify
      expect(result).toHaveLength(0);
    });
  });
});
