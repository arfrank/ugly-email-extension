import trackers from './services/trackers';

(async () => {
  await trackers.init();

  // Update declarativeNetRequest rules based on tracker patterns
  async function updateBlockingRules() {
    // Get current rules to remove them
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map((rule) => rule.id);
    // Remove existing rules
    if (existingRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
      });
    }

    // Create new blocking rules for each tracker pattern
    const rules: chrome.declarativeNetRequest.Rule[] = [];
    let ruleId = 1;
    trackers.identifiers.forEach((pattern) => {
      // Convert regex pattern to URL filter format
      // This is a simplified conversion - may need adjustment based on actual patterns
      const urlFilter = pattern
        .replace(/\\/g, '')
        .replace(/\.\*/g, '*')
        .replace(/\$/g, '');
      rules.push({
        // eslint-disable-next-line no-plusplus
        id: ruleId++,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.BLOCK,
        },
        condition: {
          urlFilter: `*${urlFilter}*`,
          resourceTypes: [chrome.declarativeNetRequest.ResourceType.IMAGE],
          domains: ['mail.google.com'],
        },
      });
    });

    // Add the new rules
    if (rules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules,
      });
    }
  }

  // Update blocking rules after trackers are initialized
  await updateBlockingRules();

  // Keep webRequest for detection/logging (non-blocking)
  chrome.webRequest.onBeforeRequest.addListener((details: { url: string }) => {
    const pixel = trackers.match(details.url);
    if (pixel) {
      // Tracking pixel detected - should be blocked by declarativeNetRequest
    }
  }, {
    urls: ['*://*.googleusercontent.com/*'],
    types: ['image'],
  });

  chrome.runtime.onConnect.addListener((port: any) => {
    port.onMessage.addListener((data: { id: string, body: string }) => {
      const pixel = trackers.match(data.body);
      port.postMessage({ pixel, id: data.id });
    });
  });
})();
