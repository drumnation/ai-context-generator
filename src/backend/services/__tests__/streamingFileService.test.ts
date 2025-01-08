import { StreamingFileService } from '../streamingFileService';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readdir: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
  },
}));

jest.mock('../progressService');
jest.mock('../../../shared/logger');

describe('StreamingFileService', () => {
  let service: StreamingFileService;
  let testDir: string;
  let mockFiles: { [key: string]: string };

  beforeEach(() => {
    testDir = '/tmp/sfs-test-xyz';
    service = new StreamingFileService();
    mockFiles = {
      'file1.txt': 'test content',
    };

    // Mock readdir with proper withFileTypes support
    (fsPromises.readdir as jest.Mock).mockImplementation(
      async (_dir: string, options?: { withFileTypes: boolean }) => {
        const entries = Object.keys(mockFiles).map((name) => ({
          name,
          isDirectory: () => false,
          isFile: () => true,
          isSymbolicLink: () => false,
        }));
        return options?.withFileTypes ? entries : entries.map((e) => e.name);
      },
    );

    // Mock stat with proper file metadata
    (fsPromises.stat as jest.Mock).mockImplementation(
      async (filePath: string) => {
        const fileName = path.basename(filePath);
        if (mockFiles[fileName]) {
          return {
            isDirectory: () => false,
            isFile: () => true,
            size: mockFiles[fileName].length,
            mtimeMs: Date.now(),
            mtime: new Date(),
          };
        }
        throw new Error('ENOENT: no such file or directory');
      },
    );

    // Mock readFile with proper content
    (fsPromises.readFile as jest.Mock).mockImplementation(
      async (filePath: string) => {
        const fileName = path.basename(filePath);
        if (mockFiles[fileName]) {
          return mockFiles[fileName];
        }
        throw new Error('ENOENT: no such file or directory');
      },
    );

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.clearCache();
  });

  describe('generateFileTree', () => {
    it('should generate a basic file tree', async () => {
      await service.generateFileTree(testDir);
      expect(fsPromises.readdir).toHaveBeenCalled();
      expect(fsPromises.stat).toHaveBeenCalled();
      expect(fsPromises.readFile).toHaveBeenCalled();

      const filePath = path.join(testDir, 'file1.txt');
      const content = service.getFileContent(filePath);
      expect(content).toBe('test content');
    });
  });

  describe('File Cache', () => {
    it('should cache file contents after reading', async () => {
      const filePath = path.join(testDir, 'file1.txt');
      await service.generateFileTree(testDir);
      const content = service.getFileContent(filePath);
      expect(content).toBe('test content');
    });

    it('should clear cache when requested', async () => {
      const filePath = path.join(testDir, 'file1.txt');
      await service.generateFileTree(testDir);
      expect(service.getFileContent(filePath)).toBe('test content');

      service.clearCache();
      expect(service.getFileContent(filePath)).toBeUndefined();
    });
  });

  describe('File Info', () => {
    it('should provide file info for cached files', async () => {
      const filePath = path.join(testDir, 'file1.txt');
      await service.generateFileTree(testDir);
      const info = service.getFileInfo(filePath);
      expect(info).toBeDefined();
      expect(info?.size).toBe('test content'.length);
    });
  });
});
