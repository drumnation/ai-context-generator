const vscode = {
  window: {
    withProgress: jest.fn(),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
  },
  ProgressLocation: {
    Notification: 1,
  },
  CancellationToken: jest.fn(),
};

export = vscode;
