import React from 'react';
import { Link } from 'react-router-dom';
import PortalState from '../components/PortalState';

export default function NotFoundPage() {
  return (
    <main className="standalone-page">
      <PortalState
        variant="notFound"
        title="Page not found"
        message="The page you requested does not exist."
        action={
          <Link to="/dashboard" className="btn btn-primary">
            Go to overview
          </Link>
        }
      />
    </main>
  );
}
