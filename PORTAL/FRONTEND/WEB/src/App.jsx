import React from 'react';
import { AuthProvider } from './shared/auth/AuthProvider';
import AppRoutes from './shared/routing/AppRoutes';
import './shared/styles/variables.css';
import './shared/styles/layout.css';
import './modules/hostel-incharge/styles/main.css';

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
