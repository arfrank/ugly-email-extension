import trackers from './services/trackers';

(async () => {
  await trackers.init();

  type RequestDetails = {
    url: string
  };

  // Note: In Manifest V3, blocking webRequest is not available.
  // This now only observes requests without blocking.
  // Blocking should be handled via declarativeNetRequest or in content scripts.
  chrome.webRequest.onBeforeRequest.addListener((details: RequestDetails) => {
    const pixel = trackers.match(details.url);
    if (pixel) {
      // Tracking pixel detected - in V3, blocking should be handled
      // via declarativeNetRequest or content scripts
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
