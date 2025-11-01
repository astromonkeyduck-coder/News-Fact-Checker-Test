'use client';
import { useEffect } from 'react';
// Import the web component - will be bundled/loaded by build system
import '../widgets/noteworthy-chat';

export default function NoteworthyChat() {
  useEffect(() => {
    // Create and mount the Shadow DOM web component to body
    const el = document.createElement('noteworthy-chat-widget');
    el.setAttribute('data-endpoint', '/api/noteworthy');
    // Set data-open="true" for development/testing (remove in production or set to "false")
    el.setAttribute('data-open', 'false');
    document.body.appendChild(el);

    return () => {
      // Cleanup on unmount
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  return null; // Web component handles its own rendering
}


