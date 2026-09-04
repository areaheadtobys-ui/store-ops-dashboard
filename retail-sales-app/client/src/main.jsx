import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AreaProvider } from './context/AreaContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import LoginGate from './components/LoginGate.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LoginGate>
          <AreaProvider>
            <App />
          </AreaProvider>
        </LoginGate>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
