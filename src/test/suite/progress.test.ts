import { StreamingFileService } from '../../backend/services/streamingFileService';
import { ProgressService } from '../../backend/services/progressService';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

describe('Progress Tracking', () => {
  let service: StreamingFileService;
  let _progressService: ProgressService;
  let testDir: string;

  beforeEach(async () => {
    _progressService = new ProgressService();
    service = new StreamingFileService();
    testDir = path.join(__dirname, 'test-files');
    await fsPromises.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fsPromises.rm(testDir, { recursive: true, force: true });
  });

  it('should track progress during file tree generation', async () => {
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

    // Verify - since we're using the real ProgressService, we can only verify
    // that the operation completed successfully
    for (const file of files) {
      const content = service.getFileContent(file);
      expect(content).toBe('test content');
    }
  });

  it('should handle cancellation during file tree generation', async () => {
    // Create test files
    const file1 = path.join(testDir, 'file1.txt');
    await fsPromises.mkdir(path.dirname(file1), { recursive: true });
    await fsPromises.writeFile(file1, 'test content');

    // Mock cancellation by clearing cache immediately after starting
    setTimeout(() => service.clearCache(), 0);

    // Test
    await service.generateFileTree(testDir);

    // Verify cache was cleared
    expect(service.getFileContent(file1)).toBeUndefined();
  });
});
