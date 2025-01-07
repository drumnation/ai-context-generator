import * as vscode from 'vscode';
import { generateMarkdown } from '../markdownGenerator';
import { FileService } from '../fileService';
import { ContainerBase } from '../../../di/container-base';
import { WebviewPanelProvider } from '../../../di/types';
import { logger } from '../../../shared/logger';

// Mock dependencies
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
  },
  workspace: {
    fs: {
      writeFile: jest.fn().mockResolvedValue(undefined),
    },
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path })),
  },
  CancellationTokenSource: jest.fn().mockImplementation(() => ({
    token: {},
    dispose: jest.fn(),
  })),
}));
jest.mock('../../../shared/logger');
jest.mock('../fileService');

describe('MarkdownGenerator', () => {
  let mockContext: vscode.ExtensionContext;
  let mockFileService: jest.Mocked<FileService>;
  let mockContainer: jest.Mocked<ContainerBase>;
  let mockWebviewPanel: vscode.WebviewPanel;
  let mockWebviewPanelProvider: jest.Mocked<WebviewPanelProvider>;
  let mockPostMessage: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock context
    mockContext = {
      extensionPath: '/test/path',
    } as unknown as vscode.ExtensionContext;

    // Setup mock post message
    mockPostMessage = jest.fn();

    // Setup mock webview panel
    mockWebviewPanel = {
      webview: {
        postMessage: mockPostMessage,
      },
    } as unknown as vscode.WebviewPanel;

    // Setup mock webview panel provider
    mockWebviewPanelProvider = {
      getOrCreateWebviewPanel: jest.fn().mockReturnValue(mockWebviewPanel),
    } as unknown as jest.Mocked<WebviewPanelProvider>;

    // Setup mock container
    mockContainer = {
      resolve: jest.fn().mockReturnValue(mockWebviewPanelProvider),
    } as unknown as jest.Mocked<ContainerBase>;

    // Setup mock file service
    mockFileService = {
      generateFileTree: jest
        .fn()
        .mockResolvedValue({ files: [], directories: [] }),
      combineFiles: jest.fn().mockResolvedValue('Combined content'),
      readFile: jest.fn().mockResolvedValue('{}'),
      countFiles: jest.fn().mockResolvedValue(10),
      listDirectories: jest.fn().mockResolvedValue(['dir1', 'dir2']),
    } as unknown as jest.Mocked<FileService>;
  });

  describe('generateMarkdown', () => {
    const defaultParams = {
      rootPath: '/test/root',
      directoryPath: '/test/dir',
      includeDotFolders: false,
      isRoot: true,
    };

    it('should generate markdown and update webview with file tree and content', async () => {
      await generateMarkdown(
        defaultParams.rootPath,
        defaultParams.directoryPath,
        mockContext,
        defaultParams.includeDotFolders,
        defaultParams.isRoot,
        mockFileService,
        mockContainer,
      );

      // Verify container resolved webview panel provider
      expect(mockContainer.resolve).toHaveBeenCalledWith('webviewPanelService');

      // Verify file tree generation
      expect(mockFileService.generateFileTree).toHaveBeenCalledWith(
        defaultParams.directoryPath,
        defaultParams.rootPath,
        defaultParams.includeDotFolders,
        expect.objectContaining({
          chunkSize: 50,
          delayBetweenChunks: 10,
        }),
      );

      // Verify file content combination
      expect(mockFileService.combineFiles).toHaveBeenCalledWith(
        defaultParams.rootPath,
        defaultParams.directoryPath,
        defaultParams.includeDotFolders,
        expect.objectContaining({
          chunkSize: 50,
          delayBetweenChunks: 10,
        }),
      );

      // Verify markdown file was written
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Buffer),
      );

      // Verify webview updates
      expect(mockPostMessage).toHaveBeenCalledTimes(2);
      expect(mockPostMessage).toHaveBeenNthCalledWith(1, {
        command: 'updateFileTree',
        fileTree: { files: [], directories: [] },
        isRoot: true,
        mode: 'root',
      });
      expect(mockPostMessage).toHaveBeenNthCalledWith(2, {
        command: 'updateContent',
        fileTree: { files: [], directories: [] },
        combinedContent: 'Combined content',
        isRoot: true,
        mode: 'root',
      });
    });

    it('should handle Error instances during markdown generation', async () => {
      const error = new Error('Test error');
      mockFileService.generateFileTree.mockRejectedValueOnce(error);

      await generateMarkdown(
        defaultParams.rootPath,
        defaultParams.directoryPath,
        mockContext,
        defaultParams.includeDotFolders,
        defaultParams.isRoot,
        mockFileService,
        mockContainer,
      );

      expect(logger.error).toHaveBeenCalledWith('Error in generateMarkdown:', {
        error,
      });
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to generate markdown: Test error',
      );
    });

    it('should handle non-Error objects during markdown generation', async () => {
      const error = 'string error';
      mockFileService.generateFileTree.mockRejectedValueOnce(error);

      await generateMarkdown(
        defaultParams.rootPath,
        defaultParams.directoryPath,
        mockContext,
        defaultParams.includeDotFolders,
        defaultParams.isRoot,
        mockFileService,
        mockContainer,
      );

      expect(logger.error).toHaveBeenCalledWith('Error in generateMarkdown:', {
        error,
      });
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to generate markdown',
      );
    });

    it('should use correct mode based on isRoot parameter', async () => {
      await generateMarkdown(
        defaultParams.rootPath,
        defaultParams.directoryPath,
        mockContext,
        defaultParams.includeDotFolders,
        false, // isRoot = false
        mockFileService,
        mockContainer,
      );

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'directory',
        }),
      );
    });
  });
});
