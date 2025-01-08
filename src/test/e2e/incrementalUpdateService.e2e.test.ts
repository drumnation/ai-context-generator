import { IncrementalUpdateService } from '../../backend/services/incrementalUpdateService';
import { ProgressService } from '../../backend/services/progressService';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

describe('IncrementalUpdateService E2E', () => {
  let service: IncrementalUpdateService;
  let testDir: string;

  beforeEach(async () => {
    service = new IncrementalUpdateService(new ProgressService(), {
      include: ['**/*'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    });
    testDir = path.join(__dirname, 'test-files');
    try {
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }
    await fsPromises.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      // Remove test directory and all contents
      await fsPromises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up test directory:', error);
    }
  });

  it('should detect files in directory', async () => {
    // Create test files
    const file1 = path.join(testDir, 'file1.txt');
    await fsPromises.mkdir(path.dirname(file1), { recursive: true });
    await fsPromises.writeFile(file1, 'test content 1');

    // Test
    const result = await service.detectChanges(testDir, []);

    // Verify
    expect(result.files).toContain(file1);
    expect(result.files).toHaveLength(1);
    expect(result.added).toContain(file1);
    expect(result.added).toHaveLength(1);
    expect(result.removed).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it('should respect file patterns', async () => {
    // Create test files
    const srcFile = path.join(testDir, 'src/file.ts');
    const distFile = path.join(testDir, 'dist/file.ts');
    const nodeModulesFile = path.join(testDir, 'node_modules/pkg/file.ts');

    await fsPromises.mkdir(path.dirname(srcFile), { recursive: true });
    await fsPromises.mkdir(path.dirname(distFile), { recursive: true });
    await fsPromises.mkdir(path.dirname(nodeModulesFile), { recursive: true });

    await fsPromises.writeFile(srcFile, 'test content');
    await fsPromises.writeFile(distFile, 'test content');
    await fsPromises.writeFile(nodeModulesFile, 'test content');

    // Test
    const result = await service.detectChanges(testDir, []);

    // Verify
    expect(result.files).toContain(srcFile);
    expect(result.files).not.toContain(distFile);
    expect(result.files).not.toContain(nodeModulesFile);
    expect(result.added).toContain(srcFile);
    expect(result.added).toHaveLength(1);
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
    const result = await service.detectChanges(testDir, []);

    // Verify
    expect(result.files).toHaveLength(3);
    expect(result.files).toEqual(expect.arrayContaining(files));
    expect(result.added).toEqual(expect.arrayContaining(files));
    expect(result.added).toHaveLength(3);
    expect(result.removed).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it('should detect incremental changes correctly', async () => {
    // Create initial files
    const file1 = path.join(testDir, 'src/file1.ts');
    const file2 = path.join(testDir, 'src/file2.ts');

    await fsPromises.mkdir(path.dirname(file1), { recursive: true });
    await fsPromises.writeFile(file1, 'initial content 1');
    await fsPromises.writeFile(file2, 'initial content 2');

    // Get initial state
    const initialResult = await service.detectChanges(testDir, []);
    expect(initialResult.files).toHaveLength(2);
    expect(initialResult.added).toHaveLength(2);
    expect(initialResult.removed).toHaveLength(0);
    expect(initialResult.unchanged).toHaveLength(0);

    // Modify files: add one, remove one, keep one
    const file3 = path.join(testDir, 'src/file3.ts');
    await fsPromises.writeFile(file3, 'new content');
    await fsPromises.unlink(file1);

    // Test incremental changes
    const result = await service.detectChanges(testDir, initialResult.files);

    // Verify
    expect(result.files).toHaveLength(2);
    expect(result.added).toContain(file3);
    expect(result.added).toHaveLength(1);
    expect(result.removed).toContain(file1);
    expect(result.removed).toHaveLength(1);
    expect(result.unchanged).toContain(file2);
    expect(result.unchanged).toHaveLength(1);
  });

  it('should handle no changes between runs', async () => {
    // Create test files
    const file1 = path.join(testDir, 'src/unchanged1.ts');
    const file2 = path.join(testDir, 'src/unchanged2.ts');

    await fsPromises.mkdir(path.dirname(file1), { recursive: true });
    await fsPromises.writeFile(file1, 'content 1');
    await fsPromises.writeFile(file2, 'content 2');

    // Get initial state
    const initialResult = await service.detectChanges(testDir, []);

    // Test with no changes
    const result = await service.detectChanges(testDir, initialResult.files);

    // Verify
    expect(result.files).toHaveLength(2);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.unchanged).toHaveLength(2);
    expect(result.unchanged).toContain(file1);
    expect(result.unchanged).toContain(file2);
  });
});
