import React from 'react';
import Head from './components/Head';
import Body from './components/Body';
import GlobalStyle from './components/Styles';
import { AppProvider } from './contexts/AppContext';

const App: React.FC = () => {
  return (
    <AppProvider>
      <GlobalStyle />
      <Head />
      <Body />
    </AppProvider>
  );
};

export default App;
