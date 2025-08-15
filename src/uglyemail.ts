import messenger from './services/messenger';
import database from './services/indexeddb';
import { getTypedGmail, GmailInstance } from './utils/gmail';
import { applyIcons, isEligible } from './utils/dom';

const DEBOUNCE_DELAY = 250; // milliseconds

class UglyEmailTracker {
  private observer: MutationObserver | null = null;

  private debounceTimer: NodeJS.Timeout | null = null;

  private gmailInstance: GmailInstance | null = null;

  private isProcessing = false;

  private processedEmails = new Set<string>();

  constructor() {
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  private init() {
    // Initialize database and messenger
    database.init();
    messenger.listen();

    // Initialize Gmail with proper error handling
    getTypedGmail((instance) => {
      this.gmailInstance = instance;
      this.setupGmailObservers();
      this.setupMutationObserver();
      // Initial scan
      this.processEmails();
    });
  }

  private setupGmailObservers() {
    if (!this.gmailInstance) return;

    // Listen for Gmail-specific events
    this.gmailInstance.observe.on('view_email', () => {
      this.debounceProcessEmails();
    });

    this.gmailInstance.observe.on('view_thread', () => {
      this.debounceProcessEmails();
    });

    this.gmailInstance.observe.on('load', () => {
      this.debounceProcessEmails();
    });
  }

  private setupMutationObserver() {
    // Create observer to watch for DOM changes
    this.observer = new MutationObserver((mutations) => {
      // Check if any relevant changes occurred
      const hasRelevantChanges = mutations.some((mutation) => {
        // Check for added nodes that might be emails
        if (mutation.addedNodes.length > 0) {
          return Array.from(mutation.addedNodes).some((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              // Check if it's an email-related element
              return (
                element.classList?.contains('ii') // Email body
                || element.classList?.contains('a3s') // Email content
                || element.querySelector?.('.ii, .a3s, .nH') // Contains email elements
              );
            }
            return false;
          });
        }

        // Check for attribute changes on email elements
        if (mutation.type === 'attributes' && mutation.target) {
          const target = mutation.target as Element;
          return target.classList?.contains('ii') || target.classList?.contains('a3s');
        }

        return false;
      });

      if (hasRelevantChanges) {
        this.debounceProcessEmails();
      }
    });

    // Start observing the Gmail content area
    const targetNode = document.querySelector('#\\:1') || document.body;

    this.observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'], // Only watch relevant attributes
    });
  }

  private debounceProcessEmails() {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = setTimeout(() => {
      this.processEmails();
    }, DEBOUNCE_DELAY);
  }

  private async processEmails() {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      if (!this.gmailInstance) {
        console.warn('Gmail instance not available');
        return;
      }

      // Check if we're in an email view
      if (!this.gmailInstance.check.is_inside_email()) {
        // Clear processed emails when not in email view
        this.processedEmails.clear();
        return;
      }

      // Get all visible emails
      const emails = this.gmailInstance.dom.emails();

      if (!emails || emails.length === 0) {
        return;
      }

      // Process each email
      // eslint-disable-next-line no-restricted-syntax
      for (const email of emails) {
        // eslint-disable-next-line no-await-in-loop
        await this.processEmail(email);
      }
    } catch (error) {
      console.error('Error processing emails:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEmail(email: any) {
    try {
      const emailId = email.id;

      // Skip if already processed
      if (this.processedEmails.has(emailId)) {
        return;
      }

      // Mark as processed
      this.processedEmails.add(emailId);

      // Check if email is eligible for tracking detection
      if (!isEligible(email.$el)) {
        return;
      }

      const body = email.body();

      if (!body) {
        return;
      }

      // Check cache first
      const cachedResult = await database.get(emailId);

      if (cachedResult !== undefined) {
        if (cachedResult) {
          applyIcons(email.$el, cachedResult);
        }
        return;
      }

      // Send to background for checking
      const pixel = await messenger.send(body);

      // Cache the result
      await database.set(emailId, pixel);

      // Apply icons if tracker found
      if (pixel) {
        applyIcons(email.$el, pixel);
      }
    } catch (error) {
      console.error('Error processing individual email:', error);
    }
  }

  // Clean up method
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.gmailInstance) {
      // Remove Gmail observers if possible
      this.gmailInstance.observe.off('view_email');
      this.gmailInstance.observe.off('view_thread');
      this.gmailInstance.observe.off('load');
    }

    this.processedEmails.clear();
  }
}

// Initialize the tracker
const tracker = new UglyEmailTracker();

// Export for potential cleanup
(window as any).uglyEmailTracker = tracker;
