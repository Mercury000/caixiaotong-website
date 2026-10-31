(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('[data-header]');
  const imageCache = new Map();
  const players = [];
  const colorMode = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

  const loadImage = (source) => {
    const key = source.src;
    if (!imageCache.has(key)) {
      const image = new Image(source.width ?? 576, source.height ?? 1248);
      image.decoding = 'async'; image.alt = source.alt;
      if (source.srcset) { image.srcset = source.srcset; image.sizes = source.sizes; }
      image.src = source.src;
      imageCache.set(key, image.decode().then(() => {
        image.setAttribute('data-media-image', ''); image.classList.add('is-ready'); return image;
      }).catch((error) => {
        imageCache.delete(key); throw error;
      }));
    }
    return imageCache.get(key).then(async (cached) => {
      const image = cached.cloneNode();
      await image.decode();
      return image;
    });
  };
  const fadeOut = (element, duration = 220) => {
    if (reducedMotion.matches) { element.remove(); return; }
    element.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: 'ease-out' })
      .finished.then(() => element.remove()).catch(() => element.remove());
  };
  const replaceStill = (current, loaded, keepFrame = false) => {
    if (keepFrame) current.parentElement.querySelectorAll('canvas.screen-overlay').forEach((frame) => fadeOut(frame));
    if (current.src === loaded.src && current.complete && current.naturalWidth && current.classList.contains('is-ready')) return;
    const next = loaded;
    for (const attribute of current.attributes) {
      if (attribute.name.startsWith('data-')) next.setAttribute(attribute.name, attribute.value);
    }
    const previous = current;
    ['data-showcase-image', 'data-theme-image', 'data-theme-effect'].forEach((name) => previous.removeAttribute(name));
    previous.classList.add('screen-overlay'); previous.setAttribute('aria-hidden', 'true');
    current.parentElement.querySelectorAll('.screen-overlay').forEach((element) => {
      if (element !== current && element.tagName !== 'VIDEO' && (!keepFrame || element.tagName !== 'CANVAS')) element.remove();
    });
    current.replaceWith(next); next.after(previous); fadeOut(previous);
  };
  const captureFrame = (parent) => {
    const layers = [...parent.children].filter((element) => ['IMG', 'CANVAS', 'VIDEO'].includes(element.tagName));
    const source = layers.find((element) => element.videoWidth || element.naturalWidth || element.tagName === 'CANVAS');
    if (!source) return null;
    const frame = document.createElement('canvas');
    frame.width = source.videoWidth || source.naturalWidth || source.width;
    frame.height = source.videoHeight || source.naturalHeight || source.height;
    frame.className = 'screen-overlay'; frame.setAttribute('aria-hidden', 'true');
    const context = frame.getContext('2d');
    let painted = false;
    for (const layer of layers) {
      const opacity = Number(getComputedStyle(layer).opacity);
      if (!opacity || (layer.tagName === 'IMG' && (!layer.complete || !layer.naturalWidth)) ||
        (layer.tagName === 'VIDEO' && (layer.readyState < 2 || layer.dataset.presented !== 'true'))) continue;
      context.globalAlpha = opacity;
      context.drawImage(layer, 0, 0, frame.width, frame.height); painted = true;
    }
    return painted ? frame : null;
  };
  const setPlayIcon = (button, paused) => {
    const label = paused ? '继续演示' : '暂停演示';
    button.setAttribute('aria-label', label); button.setAttribute('title', label);
    button.querySelector('path').setAttribute('d', paused ? 'm7 4 8 6-8 6z' : 'M7 5v10M13 5v10');
  };

  // A static image always remains under the video, including while loading or buffering.
  const makePlayer = (elements, button, progress) => {
    let request = 0;
    let controller;
    let videos = [];
    let ready = false;
    let paused = false;
    let buffering = false;
    const releaseVideo = (video) => {
      video.pause(); video.remove(); video.removeAttribute('src'); video.load();
    };
    const stop = (keepFrame = false) => {
      ++request;
      controller?.abort(); controller = null;
      if (keepFrame === true) videos.forEach((video) => {
        if (!video.parentElement || video.dataset.presented !== 'true') return;
        const parent = video.parentElement;
        const still = captureFrame(parent);
        if (!still) return;
        parent.querySelectorAll('canvas.screen-overlay').forEach((frame) => frame.remove());
        parent.append(still);
      });
      const previous = videos; videos = []; ready = false;
      previous.forEach(releaseVideo);
      button.hidden = true; progress(0);
    };
    const sync = () => {
      if (!ready) return;
      const playing = player.visible && !paused && !buffering;
      videos.forEach((video) => {
        if (playing) video.play().catch((error) => {
          if (error.name !== 'AbortError' && videos.includes(video)) stop();
        });
        else video.pause();
      });
      setPlayIcon(button, !playing);
    };
    const load = (source, signal) => new Promise((resolve, reject) => {
      const video = document.createElement('video');
      Object.assign(video, { muted: true, defaultMuted: true, playsInline: true, preload: 'auto',
        disableRemotePlayback: true, width: source.image.width ?? 576, height: source.image.height ?? 1248 });
      video.className = 'screen-overlay'; video.setAttribute('aria-label', source.label);
      video.poster = source.image.src; video.style.opacity = '0';
      videos.push(video);
      const finish = (error) => {
        clearTimeout(timer);
        video.removeEventListener('loadeddata', loaded); video.removeEventListener('error', failed);
        signal.removeEventListener('abort', aborted);
        if (error) reject(error); else resolve(video);
      };
      const loaded = () => finish();
      const failed = () => finish(new Error('Unavailable media'));
      const aborted = () => finish(new DOMException('Cancelled', 'AbortError'));
      const timer = setTimeout(failed, 12000);
      signal.addEventListener('abort', aborted, { once: true });
      video.addEventListener('loadeddata', loaded); video.addEventListener('error', failed);
      video.src = source.src; video.load();
    });
    const start = async (sources) => {
      stop();
      const token = request;
      controller = new AbortController(); paused = false; buffering = false;
      try {
        const loaded = await Promise.all(sources.map((source) => load(source, controller.signal)));
        if (token !== request) return;
        loaded.forEach((video, index) => {
          sources[index].target().parentElement.append(video);
          video.addEventListener('error', stop, { once: true });
          video.addEventListener('waiting', () => {
            buffering = true; sync();
          });
          video.addEventListener('canplay', () => {
            if (loaded.every((item) => item.readyState >= 3)) {
              buffering = false; sync();
            }
          });
          const reveal = () => {
            if (token !== request || video.dataset.presented === 'true') return;
            const parent = video.parentElement;
            const cover = captureFrame(parent);
            if (sources[index].still) replaceStill(sources[index].target(), sources[index].still);
            parent.querySelectorAll('canvas.screen-overlay').forEach((frame) => frame.remove());
            video.dataset.presented = 'true';
            video.style.opacity = '1';
            if (cover) { parent.append(cover); fadeOut(cover); }
            else if (!reducedMotion.matches) video.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
          };
          if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(reveal);
          else video.addEventListener('playing', reveal, { once: true });
        });
        const master = loaded[0];
        master.addEventListener('timeupdate', () => {
          progress(master.duration ? master.currentTime / master.duration : 0);
          loaded.slice(1).forEach((video) => {
            if (Math.abs(video.currentTime - master.currentTime) > .12 && !video.seeking) video.currentTime = master.currentTime;
          });
        });
        master.addEventListener('ended', () => {
          // Keep the final frame while disposing of every decoder.
          loaded.forEach((video, index) => {
            if (video.readyState < 2) return;
            const still = document.createElement('canvas');
            still.width = video.videoWidth; still.height = video.videoHeight;
            still.className = 'screen-overlay'; still.setAttribute('aria-hidden', 'true');
            still.getContext('2d').drawImage(video, 0, 0);
            const parent = sources[index].target().parentElement;
            parent.querySelectorAll('canvas.screen-overlay').forEach((frame) => frame.remove());
            parent.append(still);
            if (!sources[index].holdLastFrame) fadeOut(still);
          });
          stop();
        }, { once: true });
        ready = true; button.hidden = false; sync();
      } catch {
        if (token !== request) return;
        stop();
        sources.forEach((source) => {
          if (source.still) replaceStill(source.target(), source.still, true);
        });
      }
    };
    const player = { elements, visible: false, timer: 0, onEnter: sync, onLeave: stop };
    players.push(player);
    button.addEventListener('click', () => { paused = !paused; sync(); });
    return { start, stop, get version() { return request; } };
  };

  const isFullyVisible = (player) => {
    const height = window.visualViewport?.height ?? innerHeight;
    const headerBottom = (header?.querySelector('.nav')?.getBoundingClientRect().bottom ?? 0) + 8;
    const rects = player.elements.map((element) => element.getBoundingClientRect());
    return !document.hidden && !document.querySelector('dialog[open]') && !header?.classList.contains('is-menu-open') &&
      Math.min(...rects.map((rect) => rect.top)) >= headerBottom - 2 &&
      Math.max(...rects.map((rect) => rect.bottom)) <= height - 8;
  };
  let visibilityFrame = 0;
  const checkVisibility = () => {
    visibilityFrame = 0;
    for (const player of players) {
      const visible = isFullyVisible(player);
      if (visible === player.visible && (visible || !player.timer)) continue;
      clearTimeout(player.timer); player.timer = 0;
      if (!visible) { player.visible = false; player.onLeave(); }
      else player.timer = setTimeout(() => {
        player.timer = 0;
        if (!isFullyVisible(player)) return;
        player.visible = true; player.onEnter();
      }, 180);
    }
  };
  const scheduleVisibility = () => {
    if (!visibilityFrame) visibilityFrame = requestAnimationFrame(checkVisibility);
  };
  ['scroll', 'resize'].forEach((event) => window.addEventListener(event, scheduleVisibility, { passive: true }));
  ['demo-visibility-change', 'transitionend', 'animationend'].forEach((event) => document.addEventListener(event, scheduleVisibility));
  document.addEventListener('visibilitychange', checkVisibility);
  window.visualViewport?.addEventListener('resize', scheduleVisibility, { passive: true });
  if (header) new MutationObserver(scheduleVisibility).observe(header, { attributes: true, attributeFilter: ['class'] });

  const tabs = [...document.querySelectorAll('.showcase-tab')];
  const panel = document.querySelector('#screen-panel');
  const points = document.querySelector('[data-screen-points]');
  const playButton = document.querySelector('[data-demo-play]');
  const sceneIds = [
    ['payment-privacy', 'payment-enlarge', 'payment-recharge'],
    ['hall-rooms', 'hall-electricity', 'hall-network'],
    ['bill-filter', 'bill-date', 'bill-stats'],
    ['mine-account', 'mine-profile', 'mine-theme'],
  ];
  let currentTab = -1;
  let pageRequest = 0;
  const pageImage = (index) => ({ src: `assets/${tabs[index].dataset.screen.replace('-light', `-${colorMode()}`)}.webp`,
    srcset: `assets/${tabs[index].dataset.screen.replace('-light', `-${colorMode()}`)}.webp 480w, assets/${tabs[index].dataset.screen.replace('-light', `-${colorMode()}`)}@2x.webp 960w`,
    sizes: '(max-width: 760px) 220px, 268px', width: 480, height: 1041, alt: `财小通${tabs[index].dataset.label}` });
  const pagePlayer = makePlayer([panel, document.querySelector('.showcase-tabs'), document.querySelector('[data-showcase-description]')],
    playButton, (value) => points.querySelector('.is-active')?.style.setProperty('--progress', value));
  const selectPoint = async (index, point) => {
    const token = ++pageRequest;
    pagePlayer.stop(true);
    const playbackVersion = pagePlayer.version;
    points.querySelectorAll('button').forEach((button, position) => {
      button.classList.toggle('is-active', point === position);
      button.setAttribute('aria-pressed', String(point === position));
    });
    const baseId = sceneIds[index][point];
    const id = baseId ? `${baseId}${colorMode() === 'dark' ? '-dark' : ''}` : null;
    const image = id ? { src: `assets/demos/${id}.webp`, alt: `${tabs[index].dataset.label}：${tabs[index].dataset.points.split('|')[point]}` } : pageImage(index);
    let still;
    try {
      const loaded = await loadImage(image);
      if (token !== pageRequest) return;
      still = loaded;
      if (!id || playbackVersion !== pagePlayer.version) replaceStill(document.querySelector('[data-showcase-image]'), loaded, true);
    } catch { /* Keep the complete page available when a preview is unavailable. */ }
    if (token === pageRequest && playbackVersion === pagePlayer.version && id) pagePlayer.start([{ src: `assets/demos/${id}.mp4`, image, still, holdLastFrame: true,
      label: image.alt, target: () => document.querySelector('[data-showcase-image]') }]);
  };
  const selectTab = async (index) => {
    const token = ++pageRequest;
    pagePlayer.stop(true); currentTab = index;
    const tab = tabs[index];
    tabs.forEach((item, position) => {
      item.classList.toggle('is-active', index === position);
      item.setAttribute('aria-selected', String(index === position));
      item.tabIndex = index === position ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tab.id);
    document.querySelector('[data-screen-title]').textContent = tab.dataset.title;
    document.querySelector('[data-screen-description]').textContent = tab.dataset.description;
    points.replaceChildren(...tab.dataset.points.split('|').map((label, point) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'screen-point'; button.textContent = label;
      button.setAttribute('aria-controls', 'screen-panel'); button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => selectPoint(index, point));
      li.append(button); return li;
    }));
    scheduleVisibility();
    try {
      const loaded = await loadImage(pageImage(index));
      if (token === pageRequest) replaceStill(document.querySelector('[data-showcase-image]'), loaded, true);
    } catch { /* Preserve the last image until a new static page can render. */ }
  };
  selectTab(0);
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { if (currentTab !== index) selectTab(index); });
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowRight' ? 1 : -1) + 4) % 4;
      tabs[next].focus({ preventScroll: true }); selectTab(next);
    });
  });

  const themePanel = document.querySelector('.detail-row__visual--theme');
  const themePoints = document.querySelector('[data-theme-points]');
  const themeButton = document.querySelector('[data-theme-play]');
  const themeRow = document.querySelector('#theme');
  const deviceButtons = [...themeRow.querySelectorAll('[data-theme-device]')];
  const effectOptions = themeRow.querySelector('.theme-toggles');
  const compactOptions = matchMedia('(max-width: 760px), (orientation: landscape) and (max-height: 600px) and (max-width: 1100px)');
  const syncOptionsLayout = () => {
    const rail = themeRow.querySelector('[data-pad-rail]');
    effectOptions.append(rail);
    if (compactOptions.matches) effectOptions.setAttribute('popover', 'auto');
    else {
      if (effectOptions.matches(':popover-open')) effectOptions.hidePopover();
      effectOptions.removeAttribute('popover');
    }
  };
  compactOptions.addEventListener('change', syncOptionsLayout);
  syncOptionsLayout();
  const deviceSettings = {
    phone: { floating: true, style: 'default', blur: false, topBlur: false },
    tablet: { floating: false, style: 'default', blur: false, topBlur: false, expanded: true },
  };
  let themeDevice = 'phone';
  let displayedDevice = 'phone';
  const themeSettings = () => deviceSettings[themeDevice];
  const themeVariants = ['docked-plain', 'docked-blur', 'floating-plain', 'floating-blur', 'ios-plain', 'ios-blur']
    .flatMap((variant) => [variant, `${variant}-top-blur`]);
  let themeRequest = 0;
  let themePlayTarget;
  const themePlayer = makePlayer([themePanel, themePoints], themeButton,
    (value) => themePlayTarget?.style.setProperty('--progress', value));
  effectOptions.addEventListener('toggle', (event) => {
    if (event.newState === 'open') themePlayer.stop(true);
    scheduleVisibility();
  });
  themeButton.parentElement.hidden = false; themeButton.hidden = true;
  const themeVariant = () => {
    const settings = themeSettings();
    return `${settings.floating ? settings.style === 'ios' ? 'ios' : 'floating' : 'docked'}-${settings.blur ? 'blur' : 'plain'}${settings.topBlur ? '-top-blur' : ''}`;
  };
  const themeImage = (variant = themeVariant(), device = themeDevice) => ({
    src: `assets/demos/theme-${device === 'tablet' ? 'pad' : 'bar'}-${variant}${device === 'tablet' && variant.startsWith('docked') && !deviceSettings.tablet.expanded ? '-collapsed' : ''}-${colorMode()}.webp`,
    width: device === 'tablet' ? 1280 : 576, height: device === 'tablet' ? 800 : 1248,
    alt: `${device === 'tablet' ? '平板' : '手机'}：${variant.startsWith('docked') ? device === 'tablet' ? `${deviceSettings.tablet.expanded ? '展开' : '收起'}的侧边导航` : '贴底底栏' : variant.startsWith('ios') ? 'iOS 悬浮底栏' : '默认悬浮底栏'}${variant.split('-')[1] === 'blur' && (!variant.startsWith('docked') || device !== 'tablet') ? '，底栏模糊' : ''}${variant.endsWith('-top-blur') ? '，顶栏模糊' : ''}`,
  });
  const replaceThemeDevice = (loaded, device) => {
    const current = document.querySelector('[data-theme-image]');
    if (device === displayedDevice) { replaceStill(current, loaded, true); return; }
    const figure = current.parentElement;
    const frame = captureFrame(figure);
    const cover = document.createElement('figure');
    cover.className = 'theme-preview theme-device-cover'; cover.setAttribute('aria-hidden', 'true');
    if (displayedDevice === 'tablet') cover.classList.add('theme-preview--tablet');
    Object.assign(cover.style, { width: `${figure.offsetWidth}px`, height: `${figure.offsetHeight}px`,
      left: `${figure.offsetLeft}px`, top: `${figure.offsetTop}px` });
    if (frame && !reducedMotion.matches) {
      cover.append(frame); themePanel.append(cover);
    }
    themeRow.dataset.device = device;
    figure.classList.toggle('theme-preview--tablet', device === 'tablet');
    replaceStill(current, loaded);
    figure.querySelectorAll('.screen-overlay').forEach((layer) => layer.remove());
    displayedDevice = device;
    if (frame && !reducedMotion.matches) {
      figure.animate([{ opacity: 0, transform: 'translateY(8px) scale(.97)' }, { opacity: 1, transform: 'none' }],
        { duration: 360, easing: 'cubic-bezier(.16, 1, .3, 1)' });
      cover.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px) scale(.98)' }],
        { duration: 300, easing: 'ease-out' }).finished.then(() => cover.remove()).catch(() => cover.remove());
    }
    scheduleVisibility();
  };
  const showThemeOption = (button, visible) => {
    const entering = button.hidden && visible;
    button.hidden = !visible;
    if (entering && !reducedMotion.matches) {
      button.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 240, easing: 'ease-out' });
    }
  };
  const updateThemeOptions = () => {
    const settings = themeSettings();
    deviceButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeDevice === themeDevice)));
    themeRow.querySelector('[data-theme-description]').textContent = themeDevice === 'tablet'
      ? '大屏使用侧边导航，左上角按钮可展开或收起；也能换成居中的悬浮底栏，搭配喜欢的样式与模糊效果。'
      : '底栏贴底或悬浮，样式与顶栏、底栏模糊自由搭配。滑动内容、返回上一页，直接看看组合后的效果。';
    const rail = themePoints.querySelector('[data-pad-rail]');
    showThemeOption(rail, themeDevice === 'tablet' && !settings.floating);
    rail.setAttribute('aria-pressed', String(deviceSettings.tablet.expanded));
    const railLabel = deviceSettings.tablet.expanded ? '收起侧栏' : '展开侧栏';
    rail.setAttribute('aria-label', railLabel); rail.querySelector('[data-pad-rail-label]').textContent = railLabel;
    themePoints.querySelectorAll('[data-bar-position]').forEach((button) => {
      const active = settings.floating;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    themePoints.querySelectorAll('[data-bar-style]').forEach((button) => {
      const active = button.dataset.barStyle === settings.style;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    showThemeOption(themePoints.querySelector('[data-floating-style]'), settings.floating);
    const blur = themePoints.querySelector('[data-bar-blur]');
    showThemeOption(blur, themeDevice !== 'tablet' || settings.floating);
    blur.classList.toggle('is-active', settings.blur); blur.setAttribute('aria-pressed', String(settings.blur));
    const topBlur = themePoints.querySelector('[data-bar-top-blur]');
    topBlur.classList.toggle('is-active', settings.topBlur); topBlur.setAttribute('aria-pressed', String(settings.topBlur));
  };
  const selectTheme = async ({ play = false, back = false, rail = false, target } = {}) => {
    if (effectOptions.matches(':popover-open')) effectOptions.hidePopover();
    const token = ++themeRequest;
    themePlayer.stop(true);
    themePlayTarget = target;
    const playbackVersion = themePlayer.version;
    updateThemeOptions();
    const device = themeDevice;
    const variant = themeVariant();
    const image = themeImage(variant);
    const sources = [{ src: rail
      ? `assets/demos/theme-pad-rail-${themeSettings().expanded ? 'expand' : 'collapse'}${themeSettings().topBlur ? '-top-blur' : ''}-${colorMode()}.mp4`
      : back && device === 'tablet'
        ? `assets/demos/theme-pad-back-${variant}${variant.startsWith('docked') && !themeSettings().expanded ? '-collapsed' : ''}-${colorMode()}.mp4`
        : `assets/demos/theme-${back ? 'back' : 'bar'}-${variant}-${colorMode()}.mp4`,
      label: `${image.alt}：${rail ? '侧栏切换' : back ? '预测性返回' : '滚动效果'}`, image, target: () => document.querySelector('[data-theme-image]') }];
    try {
      const loaded = await loadImage(image);
      if (token !== themeRequest) return;
      if (rail && device === displayedDevice && playbackVersion === themePlayer.version) sources[0].still = loaded;
      else replaceThemeDevice(loaded, device);
    } catch { /* Preserve the complete still while a new preview is unavailable. */ }
    if (play && device === displayedDevice && (device === 'phone' || rail || back) && token === themeRequest && playbackVersion === themePlayer.version) themePlayer.start(sources);
  };
  deviceButtons.forEach((button) => button.addEventListener('click', () => {
    if (themeDevice === button.dataset.themeDevice) return;
    themeDevice = button.dataset.themeDevice; selectTheme();
  }));
  themePoints.querySelectorAll('[data-bar-position]').forEach((button) => button.addEventListener('click', () => {
    themeSettings().floating = !themeSettings().floating; selectTheme({ play: true, target: button });
  }));
  themePoints.querySelectorAll('[data-bar-style]').forEach((button) => button.addEventListener('click', () => {
    themeSettings().style = themeSettings().style === 'ios' ? 'default' : 'ios'; selectTheme({ play: true, target: button });
  }));
  themePoints.querySelector('[data-bar-blur]').addEventListener('click', (event) => {
    themeSettings().blur = !themeSettings().blur; selectTheme({ play: true, target: event.currentTarget });
  });
  themePoints.querySelector('[data-bar-top-blur]').addEventListener('click', (event) => {
    themeSettings().topBlur = !themeSettings().topBlur; selectTheme({ play: true, target: event.currentTarget });
  });
  themePoints.querySelector('[data-theme-back]').addEventListener('click', (event) => selectTheme({ play: true, back: true, target: event.currentTarget }));
  themePoints.querySelector('[data-pad-rail]').addEventListener('click', (event) => {
    themeSettings().expanded = !themeSettings().expanded; selectTheme({ play: true, rail: true, target: event.currentTarget });
  });
  selectTheme();
  document.addEventListener('site-theme-change', () => {
    // Changing website color mode returns to stills; it never starts a movie.
    selectTab(Math.max(currentTab, 0)); selectTheme();
  });
  // Warm only still images near the modules. Browsing never requests an MP4.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach(({ target }) => {
        const images = target === panel ? tabs.map((_, index) => pageImage(index)) : themeVariants.map((variant) => themeImage(variant));
        images.forEach((source) => loadImage(source).catch(() => {})); observer.unobserve(target);
      });
    }, { rootMargin: '300px' });
    observer.observe(panel); observer.observe(themePanel);
  }
  reducedMotion.addEventListener('change', () => { pagePlayer.stop(); themePlayer.stop(); });
  scheduleVisibility();
})();
