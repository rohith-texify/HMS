import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/main.css';

// Automatically purge legacy mock session tokens so real JWT authentication is active
try {
  const activeToken = localStorage.getItem('hms_token') || sessionStorage.getItem('hms_token');
  if (activeToken && activeToken.startsWith('super-admin-session-token')) {
    localStorage.removeItem('hms_token');
    localStorage.removeItem('token');
    localStorage.removeItem('hms_user');
    sessionStorage.removeItem('hms_token');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('hms_user');
  }
} catch {
  // Ignore in strict privacy sandboxes
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
