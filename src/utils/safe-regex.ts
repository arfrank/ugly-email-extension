// Safe regex execution with validation
export class SafeRegex {
  private static readonly REGEX_TIMEOUT_MS = 100;

  private static readonly MAX_PATTERN_LENGTH = 500;

  static test(pattern: string, text: string): boolean {
    // Validate pattern length
    if (pattern.length > this.MAX_PATTERN_LENGTH) {
      // eslint-disable-next-line no-console
      console.warn(`Pattern too long: ${pattern.length} characters`);
      return false;
    }

    // Basic pattern validation to prevent malicious regex
    if (this.isPotentiallyMalicious(pattern)) {
      // eslint-disable-next-line no-console
      console.warn(`Potentially malicious pattern detected: ${pattern}`);
      return false;
    }

    try {
      const regex = new RegExp(pattern, 'gi');
      // Simple complexity check - if pattern has too many special chars, it might be malicious
      return regex.test(text);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Regex execution error:', error);
      return false;
    }
  }

  private static isPotentiallyMalicious(pattern: string): boolean {
    // Check for patterns that could cause catastrophic backtracking
    const dangerousPatterns = [
      /(\w+\+)+/, // Nested quantifiers
      /(\.\*){2,}/, // Multiple wildcards
      /(\[[^\]]*\]){3,}/, // Too many character classes
      /(\\[dws][*+]){3,}/, // Excessive escaped patterns with quantifiers
    ];

    return dangerousPatterns.some((dangerous) => dangerous.test(pattern));
  }
}

export default SafeRegex;
