/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

type Resolver = {
  [key: string]: {
    resolve: (value: any) => void;
    timestamp: number;
    timeoutId: NodeJS.Timeout;
  };
};

const MESSAGE_TIMEOUT = 30000; // 30 seconds
const CLEANUP_INTERVAL = 60000; // 1 minute

export class Messenger {
  private resolvers: Resolver = {};

  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  private startPeriodicCleanup() {
    // Clean up old pending promises periodically
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupStaleResolvers();
    }, CLEANUP_INTERVAL);
  }

  private cleanupStaleResolvers() {
    const now = Date.now();
    const staleIds: string[] = [];

    Object.entries(this.resolvers).forEach(([id, resolver]) => {
      if (now - resolver.timestamp > MESSAGE_TIMEOUT * 2) {
        staleIds.push(id);
      }
    });

    staleIds.forEach((id) => {
      this.cleanupResolver(id);
    });

    if (staleIds.length > 0) {
      console.debug(`Cleaned up ${staleIds.length} stale resolvers`);
    }
  }

  private cleanupResolver(id: string) {
    const resolver = this.resolvers[id];
    if (resolver) {
      clearTimeout(resolver.timeoutId);
      delete this.resolvers[id];
    }
  }

  send(body: string): Promise<string | null> {
    if (!body || typeof body !== 'string') {
      console.warn('Invalid message body provided');
      return Promise.resolve(null);
    }

    const id = this.generateUniqueId();

    return new Promise((resolve) => {
      // Set up timeout for this specific message
      const timeoutId = setTimeout(() => {
        console.warn(`Message ${id} timed out after ${MESSAGE_TIMEOUT}ms`);
        this.cleanupResolver(id);
        resolve(null);
      }, MESSAGE_TIMEOUT);

      // Store resolver with metadata
      this.resolvers[id] = {
        resolve,
        timestamp: Date.now(),
        timeoutId,
      };

      try {
        // Send message to content script
        window.postMessage({
          from: 'ugly-email-check',
          id,
          body,
        }, window.origin);
      } catch (error) {
        console.error('Failed to send message:', error);
        this.cleanupResolver(id);
        resolve(null);
      }
    });
  }

  listen(): void {
    window.addEventListener('message', ({ data }) => {
      if (!data || data.from !== 'ugly-email-response' || !data.id) {
        return;
      }

      const resolver = this.resolvers[data.id];

      if (resolver) {
        // Clear timeout and resolve promise
        clearTimeout(resolver.timeoutId);
        resolver.resolve(data.pixel || null);

        // Clean up resolver
        this.cleanupResolver(data.id);
      }
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private generateUniqueId(): string {
    // Generate a unique ID using timestamp and random number
    const timestamp = Date.now().toString(36);
    const randomNum = Math.random().toString(36).substring(2, 9);
    return `${timestamp}-${randomNum}`;
  }

  // Clean up method for when the extension is unloaded
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    // Clean up all pending resolvers
    Object.keys(this.resolvers).forEach((id) => {
      this.cleanupResolver(id);
    });
  }
}

export default new Messenger();
