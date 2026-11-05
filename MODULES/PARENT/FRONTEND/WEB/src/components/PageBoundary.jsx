import React from 'react';
import PropTypes from 'prop-types';
import { ErrorState } from './PageStates';

export default class PageBoundary extends React.Component {
  state = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Parent page rendering failed.', error, errorInfo);
  }

  retry = () => {
    this.setState((state) => ({ error: null, retryKey: state.retryKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <main className="page-container">
          <ErrorState
            title="This page could not be displayed"
            message="Try loading the page again. If the problem continues, contact your college administrator."
            action={
              <button type="button" className="button button-primary" onClick={this.retry}>
                Try again
              </button>
            }
          />
        </main>
      );
    }

    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

PageBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};
