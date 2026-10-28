import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ProtectedRoute from '../routes/ProtectedRoute';

export default function AdminLayout() {
  return (
    <ProtectedRoute>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </ProtectedRoute>
  );
}
