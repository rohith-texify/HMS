import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AuthProvider from './hooks/AuthProvider';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
