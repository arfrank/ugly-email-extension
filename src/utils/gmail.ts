/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable import/prefer-default-export */
import GmailFactory from '../../vendor/gmail-js';

declare global {
  interface Window {
    jQuery: any;
  }
}

const GMAIL_LOAD_TIMEOUT = 10000; // 10 seconds
const GMAIL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRIES = 5;

export function gmail(callback: (gmail: any) => void): void {
  let retries = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const tryLoadGmail = () => {
    try {
      // Check if gmail-js dependencies are ready
      if (typeof window === 'undefined' || !window.jQuery) {
        throw new Error('jQuery not available');
      }

      const gmailInstance = GmailFactory(window.jQuery);

      if (!gmailInstance) {
        throw new Error('Gmail factory returned null');
      }

      // Success - cleanup and execute callback
      cleanup();
      callback(gmailInstance);
    } catch (error) {
      console.error(`Gmail initialization attempt ${retries + 1} failed:`, error);

      retries += 1;

      if (retries >= MAX_RETRIES) {
        console.error('Failed to initialize Gmail after maximum retries');
        cleanup();
        return;
      }

      // Exponential backoff
      const delay = GMAIL_RETRY_DELAY * (2 ** (retries - 1));

      timeoutId = setTimeout(() => {
        tryLoadGmail();
      }, delay);
    }
  };

  // Start loading Gmail with a small initial delay
  // to ensure the page is ready
  timeoutId = setTimeout(() => {
    tryLoadGmail();
  }, 100);

  // Set overall timeout
  setTimeout(() => {
    if (timeoutId) {
      console.error('Gmail loading timed out');
      cleanup();
    }
  }, GMAIL_LOAD_TIMEOUT);
}

export function parseEmailFromURL(url: string): string | null {
  if (!url || typeof url !== 'string') {
    console.warn('Invalid URL provided to parseEmailFromURL');
    return null;
  }

  try {
    const match = url.match(/#[^/]+\/([^?]+)/);

    if (!match || !match[1]) {
      return null;
    }

    const emailId = match[1];

    // Basic validation - email IDs should be alphanumeric
    if (!/^[a-zA-Z0-9]+$/.test(emailId)) {
      console.warn('Invalid email ID format:', emailId);
      return null;
    }

    return emailId;
  } catch (error) {
    console.error('Error parsing email from URL:', error);
    return null;
  }
}

// Type definitions for better type safety
export interface GmailInstance {
  check: {
    is_inside_email: () => boolean;
    is_preview_pane: () => boolean;
  };
  observe: {
    on: (event: string, callback: Function) => void;
    off: (event: string, callback?: Function) => void;
  };
  dom: {
    email: (emailId: string) => EmailElement | null;
    emails: () => EmailElement[];
  };
  get: {
    email_id: () => string | null;
    current_page: () => string;
  };
}

export interface EmailElement {
  id: string;
  body: () => string;
  $el: JQuery;
}

// Export a typed version when needed
export function getTypedGmail(callback: (gmail: GmailInstance) => void): void {
  gmail((instance) => {
    // Add runtime type checking if needed
    if (!instance || !instance.check || !instance.observe) {
      console.error('Invalid Gmail instance structure');
      return;
    }
    callback(instance as GmailInstance);
  });
}
