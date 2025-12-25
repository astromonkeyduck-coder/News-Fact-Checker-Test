/**
 * SecurityCheck Component
 * Cloudflare-style human verification screen
 * 
 * Usage:
 *   <SecurityCheck 
 *     title="Checking your browser..."
 *     subtitle="For security reasons..."
 *     onVerified={() => console.log('Verified!')}
 *   />
 */

// Use global React (loaded from CDN) instead of import for Babel standalone compatibility
const { useState, useEffect } = React;

// Security config - will be loaded separately or defined inline
// For Babel standalone, we'll use a default config and allow override via props
const defaultSecurityConfig = {
  title: "Checking your browser before accessing Noteworthy News",
  subtitle: "For security reasons, we're making sure this request is coming from a real person and not an automated system.",
  loadingMessage: "This process usually takes just a few seconds.",
  estimatedTime: 3,
  logoUrl: "/nw-logo.GIF",
  showContactLink: true
};

// Try to get config from window if available (loaded separately)
const securityConfig = typeof window !== 'undefined' && window.securityConfig 
  ? window.securityConfig 
  : defaultSecurityConfig;

/**
 * Animated Spinner Component
 */
function SecuritySpinner() {
  return (
    <div 
      className="security-spinner"
      role="status"
      aria-busy="true"
      aria-label="Verifying your browser"
      style={{
        width: '48px',
        height: '48px',
        margin: '0 auto 1.5rem',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Rotating border circle */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          border: '4px solid rgba(74, 144, 226, 0.2)',
          borderTop: '4px solid #4A90E2',
          borderRadius: '50%',
          animation: 'securitySpin 1s linear infinite',
          top: 0,
          left: 0
        }}
      />
      {/* Shield icon overlay - static, not rotating */}
      <div
        style={{
          position: 'relative',
          fontSize: '20px',
          color: '#4A90E2',
          opacity: 0.8,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        🛡️
      </div>
    </div>
  );
}

/**
 * Main SecurityCheck Component
 */
export default function SecurityCheck({
  title = securityConfig.title,
  subtitle = securityConfig.subtitle,
  loadingMessage = securityConfig.loadingMessage,
  onVerified = null,
  estimatedTime = securityConfig.estimatedTime,
  showContactLink = securityConfig.showContactLink,
  logoUrl = securityConfig.logoUrl
}) {
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationProgress, setVerificationProgress] = useState(0);

  useEffect(() => {
    // TODO: Replace this simulated verification with real logic:
    // - Cloudflare Turnstile / hCaptcha verification
    // - Server-side session/token validation
    // - Rate limiting / IP reputation checks
    // - Browser fingerprinting validation
    
    let progressInterval;
    let timeoutId;

    // Simulate verification progress
    progressInterval = setInterval(() => {
      setVerificationProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    // Complete verification after estimated time (with some randomness)
    const verificationTime = estimatedTime * 1000 + (Math.random() * 1000 - 500);
    
    timeoutId = setTimeout(() => {
      setVerificationProgress(100);
      clearInterval(progressInterval);
      
      // Small delay before calling onVerified
      setTimeout(() => {
        setIsVerifying(false);
        if (onVerified && typeof onVerified === 'function') {
          onVerified();
        }
      }, 300);
    }, verificationTime);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(progressInterval);
    };
  }, [onVerified, estimatedTime]);

  return (
    <div className="security-check-container">
      <div className="security-check-card">
        {/* Logo */}
        {logoUrl && (
          <div className="security-check-logo" style={{ marginBottom: '2rem' }}>
            <img 
              src={logoUrl} 
              alt="Noteworthy News" 
              style={{
                maxWidth: '120px',
                height: 'auto',
                display: 'block',
                margin: '0 auto'
              }}
            />
          </div>
        )}

        {/* Title */}
        <h1 
          className="security-check-title"
          style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '1rem',
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 1.3
          }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        <p 
          className="security-check-subtitle"
          style={{
            fontSize: '0.95rem',
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
            marginBottom: '2rem',
            lineHeight: 1.6,
            maxWidth: '480px',
            margin: '0 auto 2rem'
          }}
        >
          {subtitle}
        </p>

        {/* Spinner */}
        <SecuritySpinner />

        {/* Loading Message */}
        <p 
          className="security-check-loading-message"
          style={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.6)',
            textAlign: 'center',
            marginBottom: '2rem'
          }}
        >
          {loadingMessage}
        </p>

        {/* Progress indicator (subtle) */}
        {isVerifying && (
          <div 
            style={{
              width: '100%',
              maxWidth: '200px',
              margin: '0 auto 1.5rem',
              height: '2px',
              background: 'rgba(74, 144, 226, 0.2)',
              borderRadius: '1px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${verificationProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #4A90E2, #5BA3F5)',
                transition: 'width 0.3s ease',
                borderRadius: '1px'
              }}
            />
          </div>
        )}

        {/* Footer */}
        <div 
          className="security-check-footer"
          style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.75rem',
            color: 'rgba(255, 255, 255, 0.5)',
            textAlign: 'center'
          }}
        >
          <p style={{ margin: '0 0 0.5rem' }}>
            If you are stuck on this screen, try refreshing or checking your connection.
          </p>
          
          {showContactLink && (
            <p style={{ margin: '0.5rem 0 0' }}>
              <a 
                href="/contact.html" 
                style={{
                  color: 'rgba(74, 144, 226, 0.8)',
                  textDecoration: 'none',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.color = '#4A90E2'}
                onMouseLeave={(e) => e.target.style.color = 'rgba(74, 144, 226, 0.8)'}
              >
                Contact us if this persists
              </a>
            </p>
          )}
          
          <div style={{ marginTop: '1rem', fontSize: '0.7rem', opacity: 0.6 }}>
            <a 
              href="/privacy.html" 
              style={{ color: 'inherit', textDecoration: 'none', marginRight: '1rem' }}
            >
              Privacy
            </a>
            <a 
              href="/terms.html" 
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              Terms
            </a>
          </div>
        </div>
      </div>

      {/* Add CSS animation if not already present */}
      {typeof document !== 'undefined' && !document.querySelector('style[data-security-check]') && (
        <style>{`
          @keyframes securitySpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      )}
    </div>
  );
}

// Also expose globally for Babel standalone (browser environment)
// This ensures it's available even if Babel compiles export default to CommonJS
if (typeof window !== 'undefined') {
  // Use setTimeout to ensure this runs after Babel compilation
  setTimeout(() => {
    if (typeof SecurityCheck !== 'undefined' && !window.SecurityCheck) {
      window.SecurityCheck = SecurityCheck;
    }
  }, 0);
}

