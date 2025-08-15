import * as gmail from '../../src/utils/gmail';

jest.mock('../../vendor/gmail-js', () => jest.fn(() => ({
  check: {
    is_inside_email: jest.fn(),
    is_preview_pane: jest.fn(),
  },
  observe: {
    on: jest.fn(),
    off: jest.fn(),
  },
  dom: {
    email: jest.fn(),
    emails: jest.fn(),
  },
  get: {
    email_id: jest.fn(),
    current_page: jest.fn(),
  },
})));

describe('gmail util', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Mock window.jQuery
    (global as any).window = global;
    (global as any).jQuery = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (global as any).jQuery;
  });

  it('loads gmail with callback', () => {
    const callback = jest.fn();
    gmail.gmail(callback);

    // Fast-forward timers to trigger initial load
    jest.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalled();
    const instance = callback.mock.calls[0][0];
    expect(instance).toBeDefined();
    expect(instance.check).toBeDefined();
    expect(instance.observe).toBeDefined();
  });

  it('parses email ID from URL', () => {
    const emailId = gmail.parseEmailFromURL('#inbox/12345abc');
    expect(emailId).toBe('12345abc');
  });

  it('returns null for invalid URL', () => {
    const emailId = gmail.parseEmailFromURL('invalid-url');
    expect(emailId).toBeNull();
  });

  it('returns null for URL without email ID', () => {
    const emailId = gmail.parseEmailFromURL('#inbox/');
    expect(emailId).toBeNull();
  });

  it('handles typed gmail instance', () => {
    const callback = jest.fn();
    gmail.getTypedGmail(callback);

    // Fast-forward timers
    jest.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalled();
    expect(callback.mock.calls[0][0]).toBeDefined();
  });
});
