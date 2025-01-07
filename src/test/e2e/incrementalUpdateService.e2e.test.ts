import * as path from 'path';
import * as fs from 'fs/promises';
import { IncrementalUpdateService } from '../../backend/services/incrementalUpdateService';
import { createTempDir, delay, removeTempDir } from '../testUtils';

describe('IncrementalUpdateService E2E', () => {
  let service: IncrementalUpdateService;
  let tempDir: string;

  beforeEach(async () => {
    service = new IncrementalUpdateService();
    tempDir = await createTempDir('incremental-update-e2e');
  });

  afterEach(async () => {
    await removeTempDir(tempDir);
  });

  async function createFile(
    filename: string,
    content: string = 'test content',
  ): Promise<string> {
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content);
    return filePath;
  }

  async function modifyFile(
    filePath: string,
    newContent: string = 'modified content',
  ): Promise<void> {
    await fs.writeFile(filePath, newContent);
  }

  it('should detect new files in real filesystem', async () => {
    // Initial state
    const file1 = await createFile('test1.txt');

    // First scan
    const result1 = await service.detectChanges(tempDir, []);
    expect(result1.newFiles).toContain(file1);
    expect(result1.changedFiles).toHaveLength(0);
    expect(result1.deletedFiles).toHaveLength(0);

    // Add new file
    const file2 = await createFile('test2.txt');

    // Second scan - include file1 in previous files since we know about it
    const result2 = await service.detectChanges(tempDir, [file1]);
    expect(result2.newFiles).toContain(file2);
    expect(result2.changedFiles).toHaveLength(0);
    expect(result2.deletedFiles).toHaveLength(0);
  });

  it('should detect modified files in real filesystem', async () => {
    // Initial state
    const file1 = await createFile('test1.txt');

    // First scan to establish baseline
    await service.detectChanges(tempDir, []);

    // Ensure file modification time will be different
    await delay(1000);

    // Modify file
    await modifyFile(file1);

    // Check for changes
    const result = await service.detectChanges(tempDir, [file1]);
    expect(result.changedFiles).toContain(file1);
    expect(result.newFiles).toHaveLength(0);
    expect(result.deletedFiles).toHaveLength(0);
  });

  it('should detect deleted files in real filesystem', async () => {
    // Initial state
    const file1 = await createFile('test1.txt');

    // First scan
    await service.detectChanges(tempDir, []);

    // Delete file
    await fs.unlink(file1);

    // Check for changes
    const result = await service.detectChanges(tempDir, [file1]);
    expect(result.deletedFiles).toContain(file1);
    expect(result.newFiles).toHaveLength(0);
    expect(result.changedFiles).toHaveLength(0);
  });

  it('should handle multiple concurrent changes in real filesystem', async () => {
    // Initial state
    const file1 = await createFile('test1.txt');
    const file2 = await createFile('test2.txt');

    // First scan
    await service.detectChanges(tempDir, []);

    // Make multiple changes
    await delay(1000);
    await modifyFile(file1);
    await fs.unlink(file2);
    const file3 = await createFile('test3.txt');

    // Check for changes
    const result = await service.detectChanges(tempDir, [file1, file2]);
    expect(result.changedFiles).toContain(file1);
    expect(result.deletedFiles).toContain(file2);
    expect(result.newFiles).toContain(file3);
  });

  it('should maintain state across multiple scans in real filesystem', async () => {
    // Initial state
    const file1 = await createFile('test1.txt');

    // First scan to establish baseline
    const result0 = await service.detectChanges(tempDir, []);
    expect(result0.newFiles).toContain(file1);

    // No changes should be detected in second scan
    const result1 = await service.detectChanges(tempDir, [file1]); // Pass file1 as known
    expect(result1.changedFiles).toHaveLength(0);
    expect(result1.newFiles).toHaveLength(0);
    expect(result1.deletedFiles).toHaveLength(0);

    // Modify file
    await delay(1000);
    await modifyFile(file1);

    // Changes should be detected
    const result2 = await service.detectChanges(tempDir, [file1]);
    expect(result2.changedFiles).toContain(file1);
    expect(result2.newFiles).toHaveLength(0);
    expect(result2.deletedFiles).toHaveLength(0);

    // No changes should be detected again
    const result3 = await service.detectChanges(tempDir, [file1]);
    expect(result3.changedFiles).toHaveLength(0);
    expect(result3.newFiles).toHaveLength(0);
    expect(result3.deletedFiles).toHaveLength(0);
  });
});
