/**
 * GamesGallery wrapped with Error Boundary
 * This prevents the entire app from crashing if GamesGallery has an error
 */

import React from 'react';
import GamesGallery from './GamesGallery';
import ErrorBoundary from './ErrorBoundary';

/**
 * Error fallback component for GamesGallery
 */
function GamesGalleryErrorFallback({ error, resetError }) {
  return (
    <div style={{
      padding: '2rem',
      textAlign: 'center',
      color: '#fff',
      background: 'rgba(220, 38, 38, 0.1)',
      border: '1px solid rgba(220, 38, 38, 0.3)',
      borderRadius: '8px',
      margin: '2rem'
    }}>
      <h2 style={{ marginTop: 0, color: '#ef4444' }}>
        Games Gallery Error
      </h2>
      <p>
        Unable to load the games gallery. Please try refreshing the page.
      </p>
      <button
        onClick={resetError}
        style={{
          padding: '0.5rem 1rem',
          background: '#4A90E2',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginTop: '1rem'
        }}
      >
        Try Again
      </button>
    </div>
  );
}

/**
 * GamesGallery component wrapped with error boundary
 */
export default function GamesGalleryWithErrorBoundary(props) {
  return (
    <ErrorBoundary
      fallback={<GamesGalleryErrorFallback />}
      showDetails={process.env.NODE_ENV === 'development'}
    >
      <GamesGallery {...props} />
    </ErrorBoundary>
  );
}

