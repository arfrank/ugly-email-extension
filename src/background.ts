import trackers from './services/trackers';

// Convert regex pattern to URL filter format for declarativeNetRequest
export function convertPatternToUrlFilter(pattern: string): string {
  return pattern
    .replace(/\\/g, '')
    .replace(/\.\*/g, '*')
    .replace(/\$/g, '');
}

// Generate blocking rules from tracker patterns
export function generateBlockingRules(patterns: string[]): chrome.declarativeNetRequest.Rule[] {
  const rules: chrome.declarativeNetRequest.Rule[] = [];
  let ruleId = 1;

  patterns.forEach((pattern) => {
    const urlFilter = convertPatternToUrlFilter(pattern);
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

  return rules;
}

// Update declarativeNetRequest rules based on tracker patterns
export async function updateBlockingRules(patterns: string[]): Promise<void> {
  // Get current rules to remove them
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map((rule) => rule.id);

  // Remove existing rules
  if (existingRuleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
    });
  }

  // Create new blocking rules
  const rules = generateBlockingRules(patterns);

  // Add the new rules
  if (rules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules,
    });
  }
}

// Initialize background script
export async function initBackground(): Promise<void> {
  await trackers.init();

  // Update blocking rules after trackers are initialized
  await updateBlockingRules(trackers.identifiers);

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
}

// Auto-initialize when script loads (for production)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
  initBackground();
}
