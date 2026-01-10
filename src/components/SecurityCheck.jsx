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
 * Animated Spinner Component - Modern Sleek Design
 */
function SecuritySpinner() {
  return (
    <div 
      className="security-spinner"
      role="status"
      aria-busy="true"
      aria-label="Verifying your browser"
      style={{
          width: '100%',
        maxWidth: '400px',
        height: '8px',
        margin: '0 auto 2rem',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Background track */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(34, 211, 238, 0.1)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}
      />
      
      {/* Animated progress fill */}
      <div
        className="security-progress-fill"
        style={{
          position: 'absolute',
          height: '100%',
          width: '0%',
          background: 'linear-gradient(90deg, #22d3ee 0%, #4A90E2 50%, #22d3ee 100%)',
          backgroundSize: '200% 100%',
          borderRadius: '4px',
          animation: 'securityProgress 2s ease-in-out infinite, securityShimmer 2s linear infinite',
          boxShadow: '0 0 20px rgba(34, 211, 238, 0.5), 0 0 40px rgba(74, 144, 226, 0.3)'
        }}
      />
      
      {/* Glowing dots that move along the track */}
      <div
        style={{
          position: 'absolute',
          width: '12px',
          height: '12px',
          backgroundColor: '#22d3ee',
          borderRadius: '50%',
          boxShadow: '0 0 15px rgba(34, 211, 238, 0.8), 0 0 30px rgba(34, 211, 238, 0.4)',
          animation: 'securityDotMove 2s ease-in-out infinite',
          zIndex: 2
        }}
      />
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

        {/* Progress indicator (modern, subtle) */}
        {isVerifying && (
          <div 
            style={{
              width: '100%',
              maxWidth: '240px',
              margin: '0 auto 1.5rem',
              height: '3px',
              background: 'rgba(34, 211, 238, 0.15)',
              borderRadius: '2px',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div
              style={{
                width: `${verificationProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #22d3ee 0%, #4A90E2 100%)',
                transition: 'width 0.3s ease',
                borderRadius: '2px',
                boxShadow: '0 0 10px rgba(34, 211, 238, 0.5)'
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: `${100 - verificationProgress}%`,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '8px',
                height: '8px',
                backgroundColor: '#22d3ee',
                borderRadius: '50%',
                boxShadow: '0 0 10px rgba(34, 211, 238, 0.8)',
                transition: 'right 0.3s ease'
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
        <style data-security-check>{`
          @keyframes securityProgress {
            0% { width: 0%; left: 0; }
            50% { width: 85%; left: 0; }
            100% { width: 0%; left: 100%; }
          }
          @keyframes securityShimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes securityDotMove {
            0% { left: 0; opacity: 0; transform: scale(0.8); }
            10% { opacity: 1; transform: scale(1); }
            50% { left: 85%; opacity: 1; transform: scale(1); }
            90% { opacity: 1; transform: scale(1); }
            100% { left: 100%; opacity: 0; transform: scale(0.8); }
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

