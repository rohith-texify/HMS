import React from 'react';
import Sidebar from './components/Sidebar';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <AppRoutes />
      </main>
    </div>
  );
}
