import React from 'react';
import Head from './components/Head';
import Body from './components/Body';
import GlobalStyle from './components/Styles';
import { AppProvider } from './contexts/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/error-boundary.css';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <GlobalStyle />
        <Head />
        <Body />
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
