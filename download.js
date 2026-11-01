(() => {
  'use strict';

  const api = document.querySelector('meta[name="release-api"]').content.replace(/\/+$/, '');
  const get = (name) => document.querySelector(`[data-${name}]`);
  const make = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  const icon = (path) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(svg.namespaceURI, 'path');
    shape.setAttribute('d', path);
    svg.append(shape);
    return svg;
  };
  const downloadUrl = (asset) => `${api}/v1/assets/${encodeURIComponent(asset.id)}/download`;
  const size = (bytes) => Number.isFinite(bytes) && bytes >= 0 ? `${(bytes / 1048576).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} MB` : '未提供';
  const date = (value) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '未提供' : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed);
  };
  const androidVersions = { 21: '5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1', 28: '9', 29: '10', 30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15', 36: '16' };
  const system = (sdk) => androidVersions[sdk] ? `Android ${androidVersions[sdk]} 及以上` : Number.isInteger(sdk) ? `Android API ${sdk} 及以上` : '未提供';
  const validRelease = (value) => value && typeof value.id === 'string' && typeof value.versionName === 'string' && value.channel === 'stable' && Array.isArray(value.assets) && value.assets.length > 0 && value.assets.every((asset) => typeof asset.id === 'string' && typeof asset.name === 'string');
  const request = async (path, signal) => {
    const response = await fetch(`${api}${path}`, { signal, credentials: 'omit' });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  };
  const timedController = () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('请求超时', 'TimeoutError')), 15000);
    return { controller, clear: () => clearTimeout(timer) };
  };
  let feedbackTimer;
  const feedback = (message) => {
    clearTimeout(feedbackTimer);
    get('feedback').textContent = message;
    feedbackTimer = setTimeout(() => { get('feedback').textContent = ''; }, 6000);
  };
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      feedback('已复制');
    } catch {
      feedback(`未能自动复制，请手动复制：${text}`);
    }
  };

  // Release notes are untrusted text. Build native elements without interpreting HTML.
  const renderNotes = (target, notes) => {
    target.replaceChildren();
    if (typeof notes !== 'string' || !notes.trim()) {
      target.append(make('p', '', '此版本未提供更新说明。'));
      return;
    }
    let list = null;
    let code = null;
    for (const line of notes.replace(/\r\n?/g, '\n').split('\n')) {
      if (/^\s*```/.test(line)) {
        list = null;
        if (code) code = null;
        else { code = make('pre'); target.append(code); }
        continue;
      }
      if (code) { code.textContent += `${line}\n`; continue; }
      if (!line.trim()) { list = null; continue; }
      const heading = line.match(/^#{1,6}\s+(.+)$/);
      const bullet = line.match(/^\s*(?:[-*+] |\d+\.\s+)(.+)$/);
      if (heading) { list = null; target.append(make('h4', '', heading[1])); }
      else if (bullet) {
        if (!list) { list = make('ul'); target.append(list); }
        list.append(make('li', '', bullet[1]));
      } else { list = null; target.append(make('p', '', line)); }
    }
  };

  const notesDialog = document.getElementById('release-notes-dialog');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let notesOpener;
  let notesAnimation;
  const openNotes = (release, opener) => {
    if (!release || notesDialog.open) return;
    notesOpener = opener;
    get('notes-title').textContent = `财小通 v${release.versionName}`;
    get('notes-date').textContent = date(release.publishedAt);
    renderNotes(get('notes-body'), release.notes);
    notesDialog.showModal();
    document.documentElement.classList.add('is-notes-open');
    get('notes-body').scrollTop = 0;
  };
  const closeNotes = () => {
    if (!notesDialog.open || notesAnimation) return;
    if (reducedMotion.matches) { notesDialog.close(); return; }
    notesAnimation = notesDialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out' });
    notesAnimation.onfinish = () => { notesAnimation = null; notesDialog.close(); };
  };
  get('notes-close').addEventListener('click', closeNotes);
  notesDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeNotes(); });
  let pointerStartedOutside = false;
  const outsideNotes = (event) => {
    const bounds = notesDialog.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  notesDialog.addEventListener('pointerdown', (event) => { pointerStartedOutside = outsideNotes(event); });
  notesDialog.addEventListener('click', (event) => {
    if (pointerStartedOutside && outsideNotes(event)) closeNotes();
    pointerStartedOutside = false;
  });
  notesDialog.addEventListener('close', () => {
    document.documentElement.classList.remove('is-notes-open');
    notesOpener?.focus({ preventScroll: true });
  });

  let latestRelease;
  let selectedAsset;
  let latestRequest;
  let latestSequence = 0;
  let latestRetryTimer;
  let latestRetryCount = 0;
  let latestPending = true;
  let latestBusy = false;
  const retryDelays = [2000, 5000, 12000];
  const selectAsset = (asset) => {
    selectedAsset = asset;
    get('size').textContent = size(asset.sizeBytes);
    get('system').textContent = system(asset.minSdk ?? latestRelease.minSdk);
    get('filename').textContent = asset.name;
    get('package').textContent = asset.packageName || '未提供';
    get('sha').textContent = asset.sha256 || '未提供';
    get('copy-sha').hidden = !asset.sha256;
    get('download-link').href = downloadUrl(asset);
    get('download-link').setAttribute('download', asset.name);
    get('download-link').setAttribute('aria-label', `下载财小通 ${latestRelease.versionName}，${asset.name}`);
  };
  const loadLatest = async (retry = false) => {
    clearTimeout(latestRetryTimer);
    if (!retry) latestRetryCount = 0;
    const sequence = ++latestSequence;
    latestRequest?.controller.abort();
    latestRequest = timedController();
    const current = latestRequest;
    latestPending = true;
    latestBusy = true;
    get('latest-panel').setAttribute('aria-busy', 'true');
    get('latest-content').hidden = !latestRelease;
    get('latest-state').hidden = Boolean(latestRelease);
    try {
      const release = await request('/v1/releases/latest?channel=stable', current.controller.signal);
      if (sequence !== latestSequence) return;
      if (!validRelease(release)) throw new Error('Invalid release response');
      latestRelease = release;
      get('version').textContent = `v${release.versionName}`;
      get('release-name').textContent = release.name === release.versionName ? '校园一卡通 Android 客户端' : release.name || '校园一卡通 Android 客户端';
      get('published').textContent = date(release.publishedAt);
      get('asset-select').replaceChildren(...release.assets.map((asset, index) => {
        const option = make('option', '', `${asset.name} · ${size(asset.sizeBytes)}`);
        option.value = String(index);
        return option;
      }));
      get('asset-picker').hidden = release.assets.length <= 1;
      get('latest-content').querySelectorAll('details').forEach((details) => { details.open = false; });
      selectAsset(release.assets[0]);
      get('latest-content').hidden = false;
      get('latest-state').hidden = true;
      latestPending = false;
      get('latest-panel').setAttribute('aria-busy', 'false');
    } catch {
      if (sequence !== latestSequence) return;
      if (latestRetryCount < retryDelays.length) {
        latestRetryTimer = setTimeout(() => loadLatest(true), retryDelays[latestRetryCount++]);
      }
    } finally {
      current.clear();
      if (sequence === latestSequence) latestBusy = false;
    }
  };
  get('latest-notes-open').addEventListener('click', (event) => openNotes(latestRelease, event.currentTarget));
  get('asset-select').addEventListener('change', (event) => selectAsset(latestRelease.assets[Number(event.target.value)]));
  get('copy-sha').addEventListener('click', () => copy(selectedAsset.sha256));
  get('copy-page').addEventListener('click', () => {
    const url = new URL(location.href);
    url.hash = '';
    url.search = '';
    copy(url.href);
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-download-link], .history-asset a')) feedback('请在浏览器的下载列表中查看安装包。');
  });
  const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isAppleMobile) {
    get('device-hint').hidden = false;
    get('device-hint').textContent = '此安装包适用于 Android 手机和平板。请在 Android 设备上打开此页面下载。';
  }

  let cursor = null;
  let historyRequest;
  let historySequence = 0;
  let searchTimer;
  let historyQuery = '';
  let retryAppend = false;
  let historyRetryTimer;
  let historyRetryCount = 0;
  let historyPending = true;
  let historyBusy = false;
  const knownIds = new Set();
  const showHistorySkeleton = (append) => {
    const template = document.getElementById('history-skeleton-template');
    get('history-skeleton').replaceChildren(...Array.from({ length: append ? 1 : 3 }, () => template.content.cloneNode(true)));
    get('history-skeleton').hidden = false;
  };
  const animateDisclosure = (card, stateAttribute) => {
    const summary = card.querySelector('summary');
    let animation;
    let expanded = card.open;
    summary.addEventListener('click', (event) => {
      event.preventDefault();
      const startHeight = card.getBoundingClientRect().height;
      expanded = animation ? !expanded : !card.open;
      animation?.cancel();
      card.dataset[stateAttribute] = String(expanded);
      if (reducedMotion.matches || !card.animate) {
        animation = null;
        card.open = expanded;
        return;
      }
      card.open = true;
      const style = getComputedStyle(card);
      const endHeight = expanded ? card.getBoundingClientRect().height : summary.getBoundingClientRect().height + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      animation = card.animate([{ height: `${startHeight}px` }, { height: `${endHeight}px` }], {
        duration: 280, easing: 'cubic-bezier(.16, 1, .3, 1)',
      });
      animation.onfinish = () => { card.open = expanded; animation = null; };
    });
  };
  const noteHighlights = (notes) => {
    if (typeof notes !== 'string') return [];
    return notes.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim())
      .filter((line) => /^[-*+]\s+/.test(line))
      .map((line) => line.replace(/^[-*+]\s+/, ''))
      .filter((line) => !/^(?:ci|build|test|chore|docs)(?:\([^)]*\))?:|^[a-z]+\((?:ci|build|test|docs|project)\):|^update version\b/i.test(line))
      .slice(0, 3).map((line) => line.replace(/^[a-z]+(?:\([^)]*\))?:\s*/i, ''));
  };
  const historyItem = (release) => {
    const item = make('article', 'history-release');
    const meta = make('header', 'history-release__meta');
    const version = make('div', 'history-version');
    version.append(make('h3', '', `v${release.versionName}`));
    const published = make('time', '', date(release.publishedAt));
    published.dateTime = release.publishedAt;
    meta.append(version, published);
    const content = make('div', 'history-release__content');
    const highlights = noteHighlights(release.notes);
    if (highlights.length) {
      const list = make('ul', 'history-highlights');
      highlights.forEach((text) => list.append(make('li', '', text)));
      content.append(list);
    } else content.append(make('p', 'history-empty-notes', '此版本未提供更新摘要。'));
    const notesButton = make('button', 'notes-link history-notes-link', '查看完整更新说明');
    notesButton.type = 'button';
    notesButton.setAttribute('aria-haspopup', 'dialog');
    notesButton.setAttribute('aria-controls', notesDialog.id);
    notesButton.append(icon('m8 5 5 5-5 5'));
    notesButton.addEventListener('click', () => openNotes(release, notesButton));
    content.append(notesButton);
    const assets = make('div', 'history-assets');
    for (const asset of release.assets) {
      const row = make('div', 'history-asset');
      const info = make('div');
      if (release.assets.length > 1) info.append(make('strong', '', asset.name));
      const metadata = make('p', 'history-asset__meta');
      metadata.append(make('span', '', system(asset.minSdk ?? release.minSdk)), make('span', '', size(asset.sizeBytes)));
      info.append(metadata);
      const link = make('a', '', '下载安装包');
      link.href = downloadUrl(asset);
      link.setAttribute('download', asset.name);
      link.setAttribute('aria-label', `下载 ${asset.name}`);
      link.append(icon('M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 16h12'));
      row.append(info, link);
      assets.append(row);
    }
    content.append(assets);
    item.append(meta, content);
    return item;
  };
  const loadHistory = async (append = false, retry = false) => {
    clearTimeout(historyRetryTimer);
    if (!retry) historyRetryCount = 0;
    const sequence = ++historySequence;
    historyRequest?.controller.abort();
    historyRequest = timedController();
    const current = historyRequest;
    retryAppend = append;
    historyPending = true;
    historyBusy = true;
    if (!append && !retry) {
      cursor = null;
      knownIds.clear();
      get('release-list').replaceChildren();
      get('history-total').textContent = '';
      get('history-records').scrollTop = 0;
    }
    get('history-records').setAttribute('aria-busy', 'true');
    get('history-status').textContent = '';
    showHistorySkeleton(append);
    get('load-more').hidden = true;
    const params = new URLSearchParams({ channel: 'stable', limit: '10', q: historyQuery });
    if (append && cursor) params.set('cursor', cursor);
    try {
      const response = await request(`/v1/releases?${params}`, current.controller.signal);
      if (sequence !== historySequence) return;
      if (!Array.isArray(response.items) || !response.items.every(validRelease) || !Number.isInteger(response.total)) throw new Error('Invalid release list');
      const fragment = document.createDocumentFragment();
      for (const release of response.items) {
        if (knownIds.has(release.id)) continue;
        knownIds.add(release.id);
        fragment.append(historyItem(release));
      }
      get('release-list').append(fragment);
      get('history-skeleton').hidden = true;
      cursor = response.nextCursor || null;
      get('history-total').textContent = `${response.total} 个版本`;
      get('history-status').textContent = response.total === 0 ? historyQuery ? '没有找到匹配的正式版本，试试其他关键词。' : '暂无正式版记录。' : '';
      get('load-more').hidden = !cursor;
      historyPending = false;
    } catch (error) {
      if (sequence !== historySequence) return;
      if (error.status === 400 && append) {
        // An expired cursor restarts from page one while preserving readable cards.
        cursor = null;
      }
      if (historyRetryCount < retryDelays.length) {
        historyRetryTimer = setTimeout(() => loadHistory(append, true), retryDelays[historyRetryCount++]);
      }
    } finally {
      current.clear();
      if (sequence === historySequence) {
        historyBusy = false;
        get('history-records').setAttribute('aria-busy', String(historyPending));
      }
    }
  };
  const searchHistory = () => {
    clearTimeout(searchTimer);
    clearTimeout(historyRetryTimer);
    historyQuery = get('search').value.trim();
    loadHistory();
  };
  get('search-form').addEventListener('submit', (event) => { event.preventDefault(); searchHistory(); });
  get('search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    clearTimeout(historyRetryTimer);
    // Cancel before the debounce, so an old response cannot overwrite a new search.
    historySequence++;
    historyRequest?.controller.abort();
    historyBusy = false;
    get('load-more').hidden = true;
    searchTimer = setTimeout(searchHistory, 300);
  });
  get('load-more').addEventListener('click', () => loadHistory(true));

  const resumeRequests = () => {
    if (document.hidden || !navigator.onLine) return;
    if (latestPending && !latestBusy) loadLatest();
    if (historyPending && !historyBusy) loadHistory(retryAppend, true);
  };
  window.addEventListener('online', resumeRequests);
  document.addEventListener('visibilitychange', resumeRequests);

  document.querySelectorAll('.faq-list details').forEach((card) => animateDisclosure(card, 'faqExpanded'));

  loadLatest();
  loadHistory();
})();
