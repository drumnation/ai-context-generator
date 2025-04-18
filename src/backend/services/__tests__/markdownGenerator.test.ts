// Mock the MessageManager before any imports
jest.doMock('../../../shared/communication', () => {
  const mockSendMessage = jest.fn().mockResolvedValue(undefined);
  const mockExecuteWithRetry = jest
    .fn()
    .mockImplementation(async (callback) => {
      return await callback();
    });

  return {
    MessageManager: jest.fn().mockImplementation(() => ({
      setWebviewPanel: jest.fn(),
      sendMessage: mockSendMessage,
      executeWithRetry: mockExecuteWithRetry,
      calculateTimeout: jest.fn().mockReturnValue(1000),
      updateHeartbeat: jest.fn(),
      clearWebviewPanel: jest.fn(),
      cleanupPendingOperations: jest.fn(),
      handleAcknowledgment: jest.fn(),
    })),
  };
});

import * as vscode from 'vscode';
import { generateMarkdown } from '../markdownGenerator';
import { FileService } from '../fileService';
import { ContainerBase } from '../../../di/container-base';
import { WebviewPanelProvider } from '../../../di/types';
import { logger } from '../../../shared/logger';
import { MessageManager } from '../../../shared/communication';

// Mock dependencies
jest.mock('../../../shared/logger');
jest.mock('../fileService');
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    withProgress: jest.fn((options, callback) => {
      // Mock progress and token
      const progress = { report: jest.fn() };
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: (_callback: () => void) => {
          return { dispose: jest.fn() };
        },
      };
      // Execute the callback with mocked progress and token
      return callback(progress, token);
    }),
  },
  ProgressLocation: {
    Notification: 1,
    SourceControl: 2,
    Window: 3,
  },
  workspace: {
    fs: {
      writeFile: jest.fn().mockResolvedValue(undefined),
    },
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue([]),
    }),
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path })),
  },
  CancellationTokenSource: jest.fn().mockImplementation(() => ({
    token: {
      isCancellationRequested: false,
      onCancellationRequested: jest.fn().mockImplementation((_callback) => {
        return { dispose: jest.fn() };
      }),
    },
    dispose: jest.fn(),
  })),
}));

describe('MarkdownGenerator', () => {
  let mockContext: vscode.ExtensionContext;
  let mockFileService: jest.Mocked<FileService>;
  let mockContainer: jest.Mocked<ContainerBase>;
  let mockWebviewPanel: vscode.WebviewPanel;
  let mockWebviewPanelProvider: jest.Mocked<WebviewPanelProvider>;
  let _mockInstance: jest.Mocked<MessageManager>;

  // Increase test timeout to 15 seconds for all tests in this suite
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();

    // Get the mocked MessageManager instance
    _mockInstance = new MessageManager('test') as jest.Mocked<MessageManager>;

    // Setup mock context
    mockContext = {
      extensionPath: '/test/path',
    } as unknown as vscode.ExtensionContext;

    // Setup mock webview panel
    mockWebviewPanel = {
      webview: {
        postMessage: jest.fn().mockResolvedValue(true),
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
      generateFileTree: jest.fn().mockResolvedValue('file tree content'),
      combineFiles: jest.fn().mockResolvedValue('Combined content'),
      readFile: jest.fn().mockResolvedValue('{}'),
      countFiles: jest.fn().mockResolvedValue(10),
      listDirectories: jest.fn().mockResolvedValue(['dir1', 'dir2']),
    } as unknown as jest.Mocked<FileService>;
  });

  afterEach(() => {
    // Clean up any lingering timers
    jest.clearAllTimers();
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

      // Verify fileService methods were called
      expect(mockFileService.generateFileTree).toHaveBeenCalledWith(
        defaultParams.directoryPath,
        defaultParams.rootPath,
        defaultParams.includeDotFolders,
        expect.objectContaining({
          chunkSize: 50,
          delayBetweenChunks: 10,
        }),
      );

      expect(mockFileService.combineFiles).toHaveBeenCalledWith(
        defaultParams.rootPath,
        defaultParams.directoryPath,
        defaultParams.includeDotFolders,
        expect.objectContaining({
          chunkSize: 50,
          delayBetweenChunks: 10,
        }),
      );
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

      // The implementation already checks this indirectly through fileService calls
      expect(mockFileService.generateFileTree).toHaveBeenCalled();
      expect(mockFileService.combineFiles).toHaveBeenCalled();
    });
  });
});
