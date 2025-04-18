import React, { Component, ErrorInfo, ReactNode } from 'react';
import { VSCodeButton } from '../components/VSCodeComponents';
import { vscode } from '../utils/vscode-api';
import { logger } from '../../shared/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Webview Error:', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
    });

    // Notify the extension about the error
    vscode.postMessage({
      command: 'error',
      error: error.toString(),
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReload = () => {
    vscode.postMessage({ command: 'reloadWebview' });
  };

  private handleClose = () => {
    vscode.postMessage({ command: 'closeWebview' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>The webview encountered an error and couldn't continue.</p>
          {this.state.error && (
            <pre className="error-details">{this.state.error.toString()}</pre>
          )}
          <div className="error-actions">
            <VSCodeButton onClick={this.handleReload}>
              Reload Webview
            </VSCodeButton>
            <VSCodeButton onClick={this.handleClose}>Close</VSCodeButton>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
