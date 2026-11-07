import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AuthProvider from './hooks/AuthProvider';
import ToastProvider from './components/ToastProvider';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
