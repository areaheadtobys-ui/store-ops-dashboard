import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { DatasetProvider } from './context/DatasetContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import LoginGate from './components/LoginGate.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LoginGate>
          <DatasetProvider>
            <App />
          </DatasetProvider>
        </LoginGate>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
