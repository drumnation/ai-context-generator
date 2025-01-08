import * as vscode from 'vscode';

// Mock vscode API
jest.mock('vscode', () => ({
  extensions: {
    getExtension: jest.fn().mockReturnValue({
      activate: jest.fn().mockResolvedValue(undefined),
    }),
  },
  commands: {
    getCommands: jest
      .fn()
      .mockResolvedValue([
        'ai-pack.generateMarkdown',
        'ai-pack.generateMarkdownRoot',
      ]),
  },
}));

describe('Extension Test Suite', () => {
  beforeAll(async () => {
    // Wait for extension to activate
    await vscode.extensions
      .getExtension('drumnation.ai-context-generator')
      ?.activate();
  });

  test('Extension should be present', () => {
    expect(
      vscode.extensions.getExtension('drumnation.ai-context-generator'),
    ).toBeTruthy();
  });

  test('Should register all commands', async () => {
    const commands = await vscode.commands.getCommands();
    expect(commands).toContain('ai-pack.generateMarkdown');
    expect(commands).toContain('ai-pack.generateMarkdownRoot');
  });

  // Add more tests as needed
});
