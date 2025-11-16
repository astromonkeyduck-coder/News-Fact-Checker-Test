/**
 * Loading Skeleton Component
 * Shows skeleton screens while content is loading
 * 
 * Usage:
 *   <LoadingSkeleton type="post" count={3} />
 *   <LoadingSkeleton type="card" />
 */

import React from 'react';

const skeletonStyles = {
  base: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  pulse: {
    '@keyframes pulse': {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.5 }
    }
  }
};

/**
 * Post skeleton (for feed items)
 */
function PostSkeleton() {
  return (
    <div style={{
      ...skeletonStyles.base,
      padding: '1rem',
      marginBottom: '1rem',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{
          ...skeletonStyles.base,
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          flexShrink: 0
        }} />
        <div style={{ flex: 1 }}>
          <div style={{
            ...skeletonStyles.base,
            height: '16px',
            width: '40%',
            marginBottom: '0.5rem'
          }} />
          <div style={{
            ...skeletonStyles.base,
            height: '12px',
            width: '30%'
          }} />
        </div>
      </div>
      <div style={{
        ...skeletonStyles.base,
        height: '14px',
        width: '100%',
        marginBottom: '0.5rem'
      }} />
      <div style={{
        ...skeletonStyles.base,
        height: '14px',
        width: '90%',
        marginBottom: '0.5rem'
      }} />
      <div style={{
        ...skeletonStyles.base,
        height: '14px',
        width: '75%',
        marginBottom: '0.75rem'
      }} />
      <div style={{
        ...skeletonStyles.base,
        height: '200px',
        width: '100%',
        borderRadius: '12px',
        marginBottom: '0.75rem'
      }} />
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{
          ...skeletonStyles.base,
          height: '20px',
          width: '60px'
        }} />
        <div style={{
          ...skeletonStyles.base,
          height: '20px',
          width: '60px'
        }} />
        <div style={{
          ...skeletonStyles.base,
          height: '20px',
          width: '60px'
        }} />
      </div>
    </div>
  );
}

/**
 * Card skeleton (for game cards, article cards)
 */
function CardSkeleton() {
  return (
    <div style={{
      ...skeletonStyles.base,
      padding: '1rem',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div style={{
        ...skeletonStyles.base,
        height: '180px',
        width: '100%',
        borderRadius: '8px',
        marginBottom: '1rem'
      }} />
      <div style={{
        ...skeletonStyles.base,
        height: '20px',
        width: '80%',
        marginBottom: '0.5rem'
      }} />
      <div style={{
        ...skeletonStyles.base,
        height: '16px',
        width: '60%',
        marginBottom: '0.75rem'
      }} />
      <div style={{
        ...skeletonStyles.base,
        height: '14px',
        width: '100%',
        marginBottom: '0.25rem'
      }} />
      <div style={{
        ...skeletonStyles.base,
        height: '14px',
        width: '85%'
      }} />
    </div>
  );
}

/**
 * Text skeleton (for text content)
 */
function TextSkeleton({ lines = 3 }) {
  return (
    <div>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            ...skeletonStyles.base,
            height: '16px',
            width: i === lines - 1 ? '60%' : '100%',
            marginBottom: i < lines - 1 ? '0.5rem' : 0
          }}
        />
      ))}
    </div>
  );
}

/**
 * Main LoadingSkeleton component
 */
export default function LoadingSkeleton({ type = 'post', count = 1 }) {
  const skeletons = Array.from({ length: count });

  return (
    <>
      {skeletons.map((_, index) => {
        switch (type) {
          case 'post':
            return <PostSkeleton key={index} />;
          case 'card':
            return <CardSkeleton key={index} />;
          case 'text':
            return <TextSkeleton key={index} lines={3} />;
          default:
            return <PostSkeleton key={index} />;
        }
      })}
    </>
  );
}

// Add CSS for pulse animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  if (!document.querySelector('style[data-skeleton]')) {
    style.setAttribute('data-skeleton', 'true');
    document.head.appendChild(style);
  }
}

