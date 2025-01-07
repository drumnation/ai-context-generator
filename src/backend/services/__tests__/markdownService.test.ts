import * as vscode from 'vscode';
import { handleCopyToClipboard } from '../markdownService';

// Mock VSCode API
jest.mock('vscode', () => ({
  env: {
    clipboard: {
      writeText: jest.fn(),
    },
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
  },
}));

describe('MarkdownService', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCopyToClipboard', () => {
    it('should copy content to clipboard and show message when content is provided', async () => {
      const content = 'Test content';

      await handleCopyToClipboard(content);

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(content);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Content copied to clipboard',
      );
    });

    it('should not copy or show message when content is undefined', async () => {
      await handleCopyToClipboard(undefined);

      expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('should handle clipboard write errors gracefully', async () => {
      const content = 'Test content';
      const mockError = new Error('Clipboard error');
      (vscode.env.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
        mockError,
      );

      await handleCopyToClipboard(content);

      expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(content);
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to copy to clipboard: Clipboard error',
      );
    });
  });
});
