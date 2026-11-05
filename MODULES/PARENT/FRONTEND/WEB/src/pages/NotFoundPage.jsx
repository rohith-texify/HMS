import React from 'react';
import { Link } from 'react-router-dom';
import { NotFoundState } from '../components/PageStates';

export default function NotFoundPage() {
  return (
    <main className="page-container">
      <NotFoundState
        title="Page not found"
        message="The page you requested does not exist."
        action={
          <Link to="/dashboard" className="button button-primary">Go to overview</Link>
        }
      />
    </main>
  );
}
