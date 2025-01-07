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
  workspaceFolder?: { uri: Uri };
}

export interface Uri {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
  fsPath: string;
  with(change: {
    scheme?: string;
    authority?: string;
    path?: string;
    query?: string;
    fragment?: string;
  }): Uri;
  toString(): string;
  toJSON(): object;
}

export interface WebviewPanel {
  webview: unknown;
  onDidDispose: Event<void>;
  reveal(): void;
}

export interface Extension<T> {
  id: string;
  extensionUri: Uri;
  extensionPath: string;
  isActive: boolean;
  packageJSON: unknown;
  exports: T | undefined;
  activate(): Thenable<T>;
  extensionKind: ExtensionKind;
}

export interface LanguageModelChat {
  messages?: unknown[];
}

export interface LanguageModelAccessInformation {
  keyExpiresAt?: number;
  keyId?: string;
  onDidChange: Event<void>;
  canSendRequest(chat: LanguageModelChat): boolean | undefined;
}

export interface ExtensionContext {
  subscriptions: { dispose(): void }[];
  extensionPath: string;
  extensionUri: Uri;
  globalState: Memento;
  workspaceState: Memento;
  secrets: SecretStorage;
  storageUri: Uri | undefined;
  globalStorageUri: Uri;
  logUri: Uri;
  extensionMode: ExtensionMode;
  environmentVariableCollection: EnvironmentVariableCollection;
  asAbsolutePath(relativePath: string): string;
  storagePath: string;
  globalStoragePath: string;
  logPath: string;
  extension: Extension<unknown>;
  languageModelAccessInformation: LanguageModelAccessInformation;
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

const mockVSCode = {
  window: {
    withProgress: jest.fn().mockImplementation(async (options, task) => {
      const progress = { report: jest.fn() };
      const token = { isCancellationRequested: false };
      return task(progress, token);
    }),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
  },
  ProgressLocation: {
    Notification: 1,
  },
  CancellationToken: jest.fn(),
  Uri: {
    file: (path: string): Uri => ({
      scheme: 'file',
      authority: '',
      path,
      query: '',
      fragment: '',
      fsPath: path,
      with: jest.fn(),
      toString: () => `file://${path}`,
      toJSON: () => ({ scheme: 'file', path }),
    }),
  },
  ExtensionMode,
  ExtensionKind,
  EnvironmentVariableMutatorType,
} as const;

export default mockVSCode;
