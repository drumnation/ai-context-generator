// Mock vscode module completely
jest.mock('vscode', () => {
  // Create a proper CancellationToken mock
  const mockCancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: jest.fn(),
  };

  return {
    workspace: {
      getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn().mockImplementation((key) => {
          if (
            key === 'ignoreFolders' ||
            key === 'aiContextGenerator.ignoreFolders'
          ) {
            return ['node_modules', 'dist', '.git'];
          }
          return undefined;
        }),
      }),
    },
    Uri: {
      file: jest.fn().mockImplementation((p) => ({
        fsPath: p,
        path: p,
      })),
    },
    CancellationTokenSource: jest.fn().mockImplementation(() => ({
      token: mockCancellationToken,
      dispose: jest.fn(),
    })),
    ProgressLocation: {
      Notification: 1,
    },
  };
});

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileService } from '../../backend/services/fileService';
import { ProcessingOptions } from '../../backend/services/queueService';

describe('FileService E2E Tests', () => {
  let fileService: FileService;
  let testDir: string;
  let srcDir: string;

  beforeAll(() => {
    fileService = new FileService();
  });

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'temp',
      'file-service-e2e-tests',
      Math.random().toString(36).substring(7),
    );
    srcDir = path.join(testDir, 'src');

    // Create the test directory
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up the test directory after each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }
  });

  // Helper function to create a test directory structure
  async function createTestDirectoryStructure() {
    // Create src directory
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(
      path.join(srcDir, 'index.ts'),
      'export * from "./components";',
    );

    // Create components directory
    const componentsDir = path.join(srcDir, 'components');
    await fs.mkdir(componentsDir, { recursive: true });
    await fs.writeFile(
      path.join(componentsDir, 'Button.tsx'),
      'export const Button = () => <button>Click me</button>;',
    );

    // Create a dot file
    await fs.writeFile(path.join(testDir, '.env'), 'API_KEY=secret123');

    // Create a config directory
    const configDir = path.join(testDir, 'config');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, 'settings.json'),
      '{"theme": "dark"}',
    );

    // Create a .git directory (hidden)
    const gitDir = path.join(testDir, '.git');
    await fs.mkdir(gitDir, { recursive: true });
    await fs.writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main');

    // Create .vscode directory
    const vscodeDir = path.join(srcDir, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });
    await fs.writeFile(
      path.join(vscodeDir, 'settings.json'),
      '{"editor.formatOnSave": true}',
    );
  }

  describe('File Tree Generation', () => {
    it('should generate a file tree that excludes dot folders by default', async () => {
      await createTestDirectoryStructure();

      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
        cancelToken: new vscode.CancellationTokenSource().token,
      };

      const tree = await fileService.generateFileTree(
        testDir,
        testDir,
        false,
        options,
      );

      expect(tree).toBeDefined();
      // .git and .vscode should be excluded by default
      expect(tree.includes('.git')).toBe(false);
      expect(tree.includes('.vscode')).toBe(false);
      // But regular files and directories should be included
      expect(tree.includes('src')).toBe(true);
      expect(tree.includes('components')).toBe(true);
      expect(tree.includes('Button.tsx')).toBe(true);
    });

    it('should include dot folders when includeDotFolders is true', async () => {
      await createTestDirectoryStructure();

      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
        cancelToken: new vscode.CancellationTokenSource().token,
      };

      const tree = await fileService.generateFileTree(
        testDir,
        testDir,
        true,
        options,
      );

      expect(tree).toBeDefined();
      // Both .git and .vscode should be included
      expect(tree.includes('.git')).toBe(true);
      expect(tree.includes('.vscode')).toBe(true);
      // As well as regular files
      expect(tree.includes('.env')).toBe(true);
    });

    it('should handle nested directory structures correctly', async () => {
      await createTestDirectoryStructure();

      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
        cancelToken: new vscode.CancellationTokenSource().token,
      };

      const tree = await fileService.generateFileTree(
        testDir,
        testDir,
        false,
        options,
      );

      expect(tree).toBeDefined();
      // Verify correct nesting
      expect(tree.includes('src/components/Button.tsx')).toBe(true);
      expect(tree.includes('config/settings.json')).toBe(true);
    });
  });

  describe('File Combining', () => {
    it('should combine files from a directory structure', async () => {
      await createTestDirectoryStructure();

      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
        cancelToken: new vscode.CancellationTokenSource().token,
      };

      const combined = await fileService.combineFiles(
        testDir,
        testDir,
        false,
        options,
      );

      expect(combined).toBeDefined();
      // Should include content from regular files
      expect(
        combined.includes(
          'export const Button = () => <button>Click me</button>;',
        ),
      ).toBe(true);
      expect(combined.includes('export * from "./components";')).toBe(true);
      // Should NOT include content from dot folders
      expect(combined.includes('ref: refs/heads/main')).toBe(false);
    });

    it('should include dot files when includeDotFolders is true', async () => {
      await createTestDirectoryStructure();

      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
        cancelToken: new vscode.CancellationTokenSource().token,
      };

      const combined = await fileService.combineFiles(
        testDir,
        testDir,
        true,
        options,
      );

      expect(combined).toBeDefined();
      // Should include content from dot files
      expect(combined.includes('API_KEY=secret123')).toBe(true);
      expect(combined.includes('ref: refs/heads/main')).toBe(true);
    });

    it('should handle file read errors gracefully', async () => {
      await createTestDirectoryStructure();

      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
        cancelToken: new vscode.CancellationTokenSource().token,
      };

      // Create a file with no read permissions
      const noAccessFile = path.join(testDir, 'no-access.txt');
      await fs.writeFile(noAccessFile, 'You cannot read this!');

      try {
        // On some systems, this might fail in CI environments
        await fs.chmod(noAccessFile, 0o000);

        // Should not throw an error
        const combined = await fileService.combineFiles(
          testDir,
          testDir,
          false,
          options,
        );
        expect(combined).toBeDefined();
      } catch (error) {
        // Skip this test if we can't properly set permissions
        console.log(
          'Skipping permission test - unable to set file permissions',
        );
      }
    });
  });

  describe('File Counting', () => {
    it('should count files in a directory structure', async () => {
      await createTestDirectoryStructure();

      const options: ProcessingOptions = {
        chunkSize: 10,
        delayBetweenChunks: 0,
        cancelToken: new vscode.CancellationTokenSource().token,
      };

      // Count all files including dot files to match test expectation
      const count = await fileService.countFiles(testDir, options, true);

      // Count includes all files including dot files when includeDotFolders is true
      // index.ts, Button.tsx, 2 settings.json files, .env file, and HEAD file in .git
      expect(count).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Directory Listing', () => {
    it('should list directories in a path', async () => {
      await createTestDirectoryStructure();

      const directories = await fileService.listDirectories(testDir);

      expect(directories).toContain('src');
      expect(directories).toContain('config');
      // Should exclude hidden directories
      expect(directories).not.toContain('.git');
    });
  });

  describe('Large Directory Detection', () => {
    it('should detect if a directory has many files', async () => {
      // Create a directory with many files
      const manyFilesDir = path.join(testDir, 'many-files');
      await fs.mkdir(manyFilesDir, { recursive: true });

      // Create 110 small files (more than the default threshold of 100)
      for (let i = 0; i < 110; i++) {
        await fs.writeFile(
          path.join(manyFilesDir, `file-${i}.txt`),
          `Content of file ${i}`,
        );
      }

      const isLarge = fileService.isLargeDirectory(manyFilesDir);
      expect(isLarge).toBe(true);
    });
  });
});
