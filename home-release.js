(() => {
  'use strict';

  const api = document.querySelector('meta[name="release-api"]').content.replace(/\/+$/, '');
  const metadata = document.querySelectorAll('[data-home-release]');
  const androidVersions = { 21: '5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1', 28: '9', 29: '10', 30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15', 36: '16' };
  const retryDelays = [2000, 5000, 12000];
  let retryTimer;
  let retryCount = 0;
  let busy = false;
  let loaded = false;

  const loadRelease = async (retry = false) => {
    if (busy || loaded) return;
    clearTimeout(retryTimer);
    if (!retry) retryCount = 0;
    busy = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${api}/v1/releases/latest?channel=stable`, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const release = await response.json();
      if (!release || release.channel !== 'stable' || typeof release.versionName !== 'string' || !release.versionName.trim() || !Array.isArray(release.assets) || !release.assets[0]) {
        throw new Error('Invalid release response');
      }
      const version = `v${release.versionName}`;
      const sdk = release.assets[0].minSdk ?? release.minSdk;
      const android = androidVersions[sdk];
      const system = android ? `Android ${android} 及以上` : Number.isInteger(sdk) ? `Android API ${sdk} 及以上` : null;
      metadata.forEach((element) => {
        const requirement = system && (element.dataset.homeRelease === 'hero' && android ? `Android ${android}+` : system);
        const details = (element.dataset.homeRelease === 'hero' ? [requirement, version] : [version, requirement]).filter(Boolean);
        element.prepend(...details.flatMap((value) => {
          const separator = document.createElement('span');
          separator.textContent = '·';
          return [value, separator];
        }));
      });
      loaded = true;
    } catch {
      if (retryCount < retryDelays.length) {
        retryTimer = setTimeout(() => loadRelease(true), retryDelays[retryCount++]);
      }
    } finally {
      clearTimeout(timeout);
      busy = false;
    }
  };

  const resumeRequest = () => {
    if (!document.hidden && navigator.onLine) loadRelease();
  };
  window.addEventListener('online', resumeRequest);
  document.addEventListener('visibilitychange', resumeRequest);
  loadRelease();
})();
