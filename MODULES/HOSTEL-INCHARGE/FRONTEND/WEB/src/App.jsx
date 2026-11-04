import React from 'react';
import { AuthProvider } from './hooks/AuthProvider';
import AppRoutes from './routes/AppRoutes';
import ErrorBoundary from './app/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}
