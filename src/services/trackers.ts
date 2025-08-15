import { SafeRegex } from '../utils/safe-regex';

export class Trackers {
  version: number;

  identifiers: string[] = [];

  pixels = new Map<string, string>();

  private cache: {
    data: { name: string; pattern: string }[] | null;
    version: number | null;
    timestamp: number;
  } = {
    data: null,
    version: null,
    timestamp: 0,
  };

  private readonly CACHE_DURATION_MS = 3600000; // 1 hour

  async init() {
    const now = Date.now();

    // Use cached data if available and fresh
    if (
      this.cache.data
      && this.cache.version !== null
      && (now - this.cache.timestamp) < this.CACHE_DURATION_MS
    ) {
      this.version = this.cache.version;
      this.processCachedTrackers(this.cache.data);
      return;
    }

    try {
      const trackers = await Trackers.fetchTrackers();
      const version = await Trackers.fetchVersion();

      // Validate fetched data
      if (!this.validateTrackerData(trackers)) {
        throw new Error('Invalid tracker data received');
      }

      // Update cache
      this.cache = {
        data: trackers,
        version,
        timestamp: now,
      };

      this.version = version;
      this.processCachedTrackers(trackers);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize trackers:', error);
      // Use fallback patterns if fetch fails
      this.useFallbackPatterns();
    }
  }

  private processCachedTrackers(trackers: { name: string; pattern: string }[]) {
    this.identifiers = [];
    this.pixels.clear();

    trackers.forEach(({ name, pattern }) => {
      if (this.isValidPattern(pattern)) {
        this.identifiers.push(pattern);
        this.pixels.set(pattern, name);
      }
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private validateTrackerData(trackers: any): trackers is { name: string; pattern: string }[] {
    if (!Array.isArray(trackers)) return false;

    return trackers.every(
      (tracker) => typeof tracker === 'object'
        && typeof tracker.name === 'string'
        && typeof tracker.pattern === 'string'
        && tracker.name.length > 0
        && tracker.name.length < 100
        && tracker.pattern.length > 0
        && tracker.pattern.length < 500,
    );
  }

  // eslint-disable-next-line class-methods-use-this
  private isValidPattern(pattern: string): boolean {
    // Basic validation for pattern safety
    return pattern.length > 0 && pattern.length < 500 && !pattern.includes('constructor');
  }

  private useFallbackPatterns() {
    // Critical tracking patterns that should always be blocked
    const fallbackPatterns = [
      { name: 'SendGrid', pattern: '\\/wf\\/open\\?upn=' },
      { name: 'MailChimp', pattern: '\\/track\\/open\\.php\\?u=' },
      { name: 'Mailtrack', pattern: 'mailtrack\\.io\\/trace' },
      { name: 'Yesware', pattern: 't\\.yesware\\.com' },
      { name: 'Streak', pattern: 'mailfoogae\\.appspot\\.com' },
    ];

    this.version = 0; // Indicate fallback mode
    this.processCachedTrackers(fallbackPatterns);
  }

  static async fetchTrackers(): Promise<{ name: string, pattern: string }[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(
        `https://trackers.uglyemail.com/list.txt?ts=${new Date().getTime()}`,
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();

      // Validate response size
      if (text.length > 100000) {
        throw new Error('Response too large');
      }

      return text.split('\n')
        .filter((row) => row.trim().length > 0)
        .map((row) => {
          const [name, pattern] = row.split('@@=');
          return { name: name || '', pattern: pattern || '' };
        })
        .filter(({ name, pattern }) => name && pattern);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch trackers:', error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async fetchVersion(): Promise<number> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `https://trackers.uglyemail.com/version.txt?ts=${new Date().getTime()}`,
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      const version = parseInt(text, 10);

      if (Number.isNaN(version) || version < 0 || version > 999999) {
        throw new Error('Invalid version number');
      }

      return version;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch version:', error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  match(body: string): string | null {
    if (!body || typeof body !== 'string') {
      return null;
    }

    // Limit body size to prevent performance issues
    const truncatedBody = body.slice(0, 10000);

    const pixel = this.identifiers.find((p) => {
      try {
        return SafeRegex.test(p, truncatedBody);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error matching pattern:', p, error);
        return false;
      }
    });

    return pixel ? this.pixels.get(pixel) || null : null;
  }
}

export default new Trackers();
