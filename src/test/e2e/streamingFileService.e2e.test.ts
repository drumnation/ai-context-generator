import { StreamingFileService } from '../../backend/services/streamingFileService';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

describe('StreamingFileService E2E', () => {
  let service: StreamingFileService;
  let testDir: string;

  beforeEach(async () => {
    service = new StreamingFileService();
    testDir = path.join(__dirname, 'test-files');
    await fsPromises.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fsPromises.rm(testDir, { recursive: true, force: true });
  });

  it('should generate file tree and cache files', async () => {
    // Create test files
    const file1 = path.join(testDir, 'file1.txt');
    await fsPromises.mkdir(path.dirname(file1), { recursive: true });
    await fsPromises.writeFile(file1, 'test content 1');

    // Test
    await service.generateFileTree(testDir);

    // Verify
    const content = service.getFileContent(file1);
    expect(content).toBe('test content 1');
  });

  it('should handle nested directories', async () => {
    // Create test files
    const files = [
      path.join(testDir, 'src/components/Button.tsx'),
      path.join(testDir, 'src/utils/helpers.ts'),
      path.join(testDir, 'src/deep/nested/file.ts'),
    ];

    for (const file of files) {
      await fsPromises.mkdir(path.dirname(file), { recursive: true });
      await fsPromises.writeFile(file, 'test content');
    }

    // Test
    await service.generateFileTree(testDir);

    // Verify
    for (const file of files) {
      const content = service.getFileContent(file);
      expect(content).toBe('test content');
    }
  });

  it('should clear cache when requested', async () => {
    // Create test file
    const file1 = path.join(testDir, 'file1.txt');
    await fsPromises.mkdir(path.dirname(file1), { recursive: true });
    await fsPromises.writeFile(file1, 'test content');

    // Generate tree to populate cache
    await service.generateFileTree(testDir);
    expect(service.getFileContent(file1)).toBe('test content');

    // Clear cache
    service.clearCache();
    expect(service.getFileContent(file1)).toBeUndefined();
  });

  it('should provide file info for cached files', async () => {
    // Create test file
    const file1 = path.join(testDir, 'file1.txt');
    await fsPromises.mkdir(path.dirname(file1), { recursive: true });
    await fsPromises.writeFile(file1, 'test content');

    // Generate tree to populate cache
    await service.generateFileTree(testDir);

    // Verify file info
    const info = service.getFileInfo(file1);
    expect(info).toBeDefined();
    expect(info?.size).toBe('test content'.length);
  });
});
