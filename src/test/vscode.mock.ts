export interface Disposable {
  dispose(): void;
}

export interface Memento {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void>;
  setKeysForSync(): void;
  keys(): readonly string[];
}

export interface SecretStorageChangeEvent {
  readonly key: string;
}

export interface SecretStorage {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
  delete(key: string): Thenable<void>;
  onDidChange: Event<SecretStorageChangeEvent>;
}

export interface Event<T> {
  (listener: (e: T) => void): Disposable;
}

export interface EnvironmentVariableMutatorOptions {
  applyAtProcessCreation?: boolean;
  applyAtShellIntegration?: boolean;
}

export interface EnvironmentVariableMutator {
  readonly value: string;
  readonly type: EnvironmentVariableMutatorType;
  readonly options: EnvironmentVariableMutatorOptions;
}

export interface EnvironmentVariableCollection {
  persistent: boolean;
  description: string;
  replace(variable: string, value: string): void;
  append(variable: string, value: string): void;
  prepend(variable: string, value: string): void;
  get(variable: string): EnvironmentVariableMutator | undefined;
  forEach(
    callback: (
      variable: string,
      mutator: EnvironmentVariableMutator,
      collection: EnvironmentVariableCollection,
    ) => void,
  ): void;
  delete(variable: string): void;
  clear(): void;
  [Symbol.iterator](): Iterator<[string, EnvironmentVariableMutator]>;
  getScoped(scope: EnvironmentVariableScope): EnvironmentVariableCollection;
}

export interface EnvironmentVariableScope {
  workspaceFolder?: { uri: { scheme: string; path: string } };
}

export interface WebviewPanel {
  webview: unknown;
  onDidDispose: Event<void>;
  reveal(): void;
}

export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}

export enum ExtensionKind {
  UI = 1,
  Workspace = 2,
}

export enum EnvironmentVariableMutatorType {
  Replace = 1,
  Append = 2,
  Prepend = 3,
}

export enum ProgressLocation {
  Notification = 1,
  SourceControl = 2,
  Window = 3,
}

export const createMockVSCode = () => ({
  window: {
    withProgress: jest.fn().mockImplementation((options, task) => {
      const progress = { report: jest.fn() };
      const token = {
        isCancellationRequested: false,
        onCancellationRequested: () => ({ dispose: () => {} }),
      };
      return task(progress, token);
    }),
    createOutputChannel: jest.fn(),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createWebviewPanel: jest.fn().mockReturnValue({
      webview: {
        html: '',
        onDidReceiveMessage: jest.fn(),
        postMessage: jest.fn().mockResolvedValue(true),
        asWebviewUri: jest.fn((uri) => uri),
      },
      onDidDispose: jest.fn(),
      reveal: jest.fn(),
      dispose: jest.fn(),
    }),
  },
  ProgressLocation,
  ExtensionMode,
  ExtensionKind,
  EnvironmentVariableMutatorType,
  workspace: {
    workspaceFolders: [],
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn(),
      update: jest.fn(),
      has: jest.fn(),
      inspect: jest.fn(),
    }),
    fs: {
      writeFile: jest.fn(),
      readFile: jest.fn(),
      delete: jest.fn(),
      createDirectory: jest.fn(),
    },
  },
  Uri: {
    file: jest.fn((path: string) => ({
      scheme: 'file',
      authority: '',
      path,
      query: '',
      fragment: '',
      fsPath: path,
      with: jest.fn(),
      toString: () => `file://${path}`,
      toJSON: () => ({ scheme: 'file', path }),
    })),
    parse: jest.fn(),
  },
  Disposable: jest.fn().mockImplementation(() => ({
    dispose: jest.fn(),
  })),
  Memento: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    update: jest.fn(),
    setKeysForSync: jest.fn(),
    keys: jest.fn(),
  })),
  SecretStorage: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    store: jest.fn(),
    delete: jest.fn(),
    onDidChange: jest.fn(),
  })),
  WebviewPanel: jest.fn().mockImplementation(() => ({
    webview: {
      html: '',
      onDidReceiveMessage: jest.fn(),
      postMessage: jest.fn().mockResolvedValue(true),
      asWebviewUri: jest.fn((uri) => uri),
    },
    onDidDispose: jest.fn(),
    reveal: jest.fn(),
    dispose: jest.fn(),
  })),
  EnvironmentVariableCollection: jest.fn().mockImplementation(() => ({
    persistent: false,
    description: '',
    replace: jest.fn(),
    append: jest.fn(),
    prepend: jest.fn(),
    get: jest.fn(),
    forEach: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    [Symbol.iterator]: jest.fn(),
    getScoped: jest.fn(),
  })),
  CancellationTokenSource: jest.fn().mockImplementation(() => ({
    token: {
      isCancellationRequested: false,
      onCancellationRequested: jest.fn(),
    },
    dispose: jest.fn(),
  })),
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn(),
    getCommands: jest
      .fn()
      .mockResolvedValue([
        'ai-pack.generateMarkdown',
        'ai-pack.generateMarkdownRoot',
      ]),
  },
  EventEmitter: jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn(),
  })),
});

export default createMockVSCode();
