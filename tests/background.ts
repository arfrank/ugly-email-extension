/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  convertPatternToUrlFilter,
  generateBlockingRules,
  updateBlockingRules,
  initBackground,
} from '../src/background';
import trackers from '../src/services/trackers';

// Mock chrome APIs
const mockChrome = {
  declarativeNetRequest: {
    RuleActionType: {
      BLOCK: 'block' as any,
    },
    ResourceType: {
      IMAGE: 'image' as any,
    },
    getDynamicRules: jest.fn(),
    updateDynamicRules: jest.fn(),
  },
  webRequest: {
    onBeforeRequest: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    onConnect: {
      addListener: jest.fn(),
    },
    id: 'test-extension-id',
  },
};

// Set up chrome mock globally
(global as any).chrome = mockChrome;

describe('Background Script', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('convertPatternToUrlFilter', () => {
    it('should convert regex patterns to URL filters', () => {
      expect(convertPatternToUrlFilter('\\/wf\\/open\\?upn=')).toBe('/wf/open?upn=');
      expect(convertPatternToUrlFilter('.*tracker.*')).toBe('*tracker*');
      expect(convertPatternToUrlFilter('pixel\\.gif$')).toBe('pixel.gif');
    });

    it('should handle complex patterns', () => {
      expect(convertPatternToUrlFilter('\\/track\\/open\\.php\\?u=')).toBe('/track/open.php?u=');
      expect(convertPatternToUrlFilter('.*\\/pixel\\..*')).toBe('*/pixel.*');
    });

    it('should handle empty patterns', () => {
      expect(convertPatternToUrlFilter('')).toBe('');
    });
  });

  describe('generateBlockingRules', () => {
    it('should generate blocking rules from patterns', () => {
      const patterns = ['\\/wf\\/open\\?upn=', '\\/track\\/open\\.php\\?u='];
      const rules = generateBlockingRules(patterns);

      expect(rules).toHaveLength(2);
      expect(rules[0]).toEqual({
        id: 1,
        priority: 1,
        action: {
          type: 'block',
        },
        condition: {
          urlFilter: '*/wf/open?upn=*',
          resourceTypes: ['image'],
          domains: ['mail.google.com'],
        },
      });
      expect(rules[1]).toEqual({
        id: 2,
        priority: 1,
        action: {
          type: 'block',
        },
        condition: {
          urlFilter: '*/track/open.php?u=*',
          resourceTypes: ['image'],
          domains: ['mail.google.com'],
        },
      });
    });

    it('should handle empty patterns array', () => {
      const rules = generateBlockingRules([]);
      expect(rules).toHaveLength(0);
    });

    it('should generate sequential rule IDs', () => {
      const patterns = ['pattern1', 'pattern2', 'pattern3'];
      const rules = generateBlockingRules(patterns);

      expect(rules[0].id).toBe(1);
      expect(rules[1].id).toBe(2);
      expect(rules[2].id).toBe(3);
    });
  });

  describe('updateBlockingRules', () => {
    it('should remove existing rules and add new ones', async () => {
      const existingRules = [
        { id: 100, action: {}, condition: {} },
        { id: 200, action: {}, condition: {} },
      ];
      mockChrome.declarativeNetRequest.getDynamicRules.mockResolvedValue(existingRules);
      mockChrome.declarativeNetRequest.updateDynamicRules.mockResolvedValue(undefined);

      const patterns = ['\\/tracker\\.gif'];
      await updateBlockingRules(patterns);

      // Should get existing rules
      expect(mockChrome.declarativeNetRequest.getDynamicRules).toHaveBeenCalled();

      // Should remove existing rules
      expect(mockChrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [100, 200],
      });

      // Should add new rules
      expect(mockChrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
        addRules: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            condition: expect.objectContaining({
              urlFilter: '*/tracker.gif*',
            }),
          }),
        ]),
      });
    });

    it('should handle no existing rules', async () => {
      mockChrome.declarativeNetRequest.getDynamicRules.mockResolvedValue([]);
      mockChrome.declarativeNetRequest.updateDynamicRules.mockResolvedValue(undefined);

      const patterns = ['\\/pixel\\.png'];
      await updateBlockingRules(patterns);

      // Should not try to remove rules if none exist
      expect(mockChrome.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalledWith({
        removeRuleIds: expect.any(Array),
      });

      // Should only add new rules
      expect(mockChrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledTimes(1);
      expect(mockChrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
        addRules: expect.any(Array),
      });
    });

    it('should handle empty patterns', async () => {
      mockChrome.declarativeNetRequest.getDynamicRules.mockResolvedValue([{ id: 1 }]);
      mockChrome.declarativeNetRequest.updateDynamicRules.mockResolvedValue(undefined);

      await updateBlockingRules([]);

      // Should remove existing rules
      expect(mockChrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
        removeRuleIds: [1],
      });

      // Should not add any rules
      expect(mockChrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledTimes(1);
    });
  });

  describe('initBackground', () => {
    it('should initialize trackers and set up listeners', async () => {
      // Mock trackers
      jest.spyOn(trackers, 'init').mockResolvedValue(undefined);
      trackers.identifiers = ['\\/tracker1', '\\/tracker2'];
      jest.spyOn(trackers, 'match').mockReturnValue('TestTracker');

      // Mock chrome APIs
      mockChrome.declarativeNetRequest.getDynamicRules.mockResolvedValue([]);
      mockChrome.declarativeNetRequest.updateDynamicRules.mockResolvedValue(undefined);

      await initBackground();

      // Should initialize trackers
      expect(trackers.init).toHaveBeenCalled();

      // Should update blocking rules with tracker identifiers
      expect(mockChrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
        addRules: expect.arrayContaining([
          expect.objectContaining({
            condition: expect.objectContaining({
              urlFilter: '*/tracker1*',
            }),
          }),
          expect.objectContaining({
            condition: expect.objectContaining({
              urlFilter: '*/tracker2*',
            }),
          }),
        ]),
      });

      // Should set up webRequest listener
      expect(mockChrome.webRequest.onBeforeRequest.addListener).toHaveBeenCalledWith(
        expect.any(Function),
        {
          urls: ['*://*.googleusercontent.com/*'],
          types: ['image'],
        },
      );

      // Should set up runtime onConnect listener
      expect(mockChrome.runtime.onConnect.addListener).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('should handle port messages correctly', async () => {
      // Mock trackers
      jest.spyOn(trackers, 'init').mockResolvedValue(undefined);
      trackers.identifiers = [];
      jest.spyOn(trackers, 'match').mockReturnValue('PixelTracker');

      mockChrome.declarativeNetRequest.getDynamicRules.mockResolvedValue([]);
      mockChrome.declarativeNetRequest.updateDynamicRules.mockResolvedValue(undefined);

      await initBackground();

      // Get the port listener that was registered
      const portListener = mockChrome.runtime.onConnect.addListener.mock.calls[0][0];

      // Create mock port
      const mockPort = {
        onMessage: {
          addListener: jest.fn(),
        },
        postMessage: jest.fn(),
      };

      // Trigger port connection
      portListener(mockPort);

      // Get the message listener that was registered
      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0];

      // Send a message to the port
      const testData = { id: 'test-id', body: 'http://tracker.com/pixel.gif' };
      messageListener(testData);

      // Verify the response
      expect(trackers.match).toHaveBeenCalledWith('http://tracker.com/pixel.gif');
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        pixel: 'PixelTracker',
        id: 'test-id',
      });
    });

    it('should detect pixels in webRequest', async () => {
      // Mock trackers
      jest.spyOn(trackers, 'init').mockResolvedValue(undefined);
      trackers.identifiers = [];
      jest.spyOn(trackers, 'match')
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('DetectedTracker');

      mockChrome.declarativeNetRequest.getDynamicRules.mockResolvedValue([]);
      mockChrome.declarativeNetRequest.updateDynamicRules.mockResolvedValue(undefined);

      await initBackground();

      // Get the webRequest listener that was registered
      const webRequestListener = mockChrome.webRequest.onBeforeRequest.addListener.mock.calls[0][0];

      // Test with non-tracking URL
      webRequestListener({ url: 'http://normal-image.com/photo.jpg' });
      expect(trackers.match).toHaveBeenCalledWith('http://normal-image.com/photo.jpg');

      // Test with tracking pixel URL
      webRequestListener({ url: 'http://tracker.com/pixel.gif' });
      expect(trackers.match).toHaveBeenCalledWith('http://tracker.com/pixel.gif');
    });
  });

  describe('Pattern conversion edge cases', () => {
    it('should handle special regex characters', () => {
      expect(convertPatternToUrlFilter('\\d+')).toBe('d+');
      expect(convertPatternToUrlFilter('[a-z]+')).toBe('[a-z]+');
      expect(convertPatternToUrlFilter('(tracker|pixel)')).toBe('(tracker|pixel)');
    });

    it('should handle URL-like patterns', () => {
      expect(convertPatternToUrlFilter('https:\\/\\/.*\\/pixel\\.gif')).toBe('https://*/pixel.gif');
      expect(convertPatternToUrlFilter('.*\\?utm_.*')).toBe('*?utm_*');
    });
  });
});
