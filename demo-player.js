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
        disableRemotePlayback: true, width: 576, height: 1248 });
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
  const themeSettings = { floating: true, style: 'default', blur: false, topBlur: false };
  const themeVariants = ['docked-plain', 'docked-blur', 'floating-plain', 'floating-blur', 'ios-plain', 'ios-blur']
    .flatMap((variant) => [variant, `${variant}-top-blur`]);
  let themeRequest = 0;
  let themePlayTarget;
  const themePlayer = makePlayer([themePanel, themePoints], themeButton,
    (value) => themePlayTarget?.style.setProperty('--progress', value));
  themeButton.parentElement.hidden = false; themeButton.hidden = true;
  const themeVariant = () => `${themeSettings.floating ? themeSettings.style === 'ios' ? 'ios' : 'floating' : 'docked'}-${themeSettings.blur ? 'blur' : 'plain'}${themeSettings.topBlur ? '-top-blur' : ''}`;
  const themeImage = (variant = themeVariant()) => ({ src: `assets/demos/theme-bar-${variant}-${colorMode()}.webp`,
    alt: `${variant.startsWith('docked') ? '贴底底栏' : variant.startsWith('ios') ? 'iOS 悬浮底栏' : '默认悬浮底栏'}${variant.split('-')[1] === 'blur' ? '，底栏模糊' : ''}${variant.endsWith('-top-blur') ? '，顶栏模糊' : ''}` });
  const updateThemeOptions = () => {
    themePoints.querySelectorAll('[data-bar-position]').forEach((button) => {
      const active = themeSettings.floating;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    themePoints.querySelectorAll('[data-bar-style]').forEach((button) => {
      const active = button.dataset.barStyle === themeSettings.style;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    themePoints.querySelector('[data-floating-style]').disabled = !themeSettings.floating;
    const blur = themePoints.querySelector('[data-bar-blur]');
    blur.classList.toggle('is-active', themeSettings.blur); blur.setAttribute('aria-pressed', String(themeSettings.blur));
    const topBlur = themePoints.querySelector('[data-bar-top-blur]');
    topBlur.classList.toggle('is-active', themeSettings.topBlur); topBlur.setAttribute('aria-pressed', String(themeSettings.topBlur));
  };
  const selectTheme = async ({ play = false, back = false, target } = {}) => {
    const token = ++themeRequest;
    themePlayer.stop(true);
    themePlayTarget = target;
    const playbackVersion = themePlayer.version;
    updateThemeOptions();
    const variant = themeVariant();
    const image = themeImage(variant);
    const sources = [{ src: `assets/demos/theme-${back ? 'back' : 'bar'}-${variant}-${colorMode()}.mp4`,
      label: `${image.alt}：${back ? '预测性返回' : '滚动效果'}`, image, target: () => document.querySelector('[data-theme-image]') }];
    try {
      const loaded = await loadImage(image);
      if (token !== themeRequest) return;
      replaceStill(sources[0].target(), loaded, true);
    } catch { /* Preserve the complete still while a new preview is unavailable. */ }
    if (play && token === themeRequest && playbackVersion === themePlayer.version) themePlayer.start(sources);
  };
  themePoints.querySelectorAll('[data-bar-position]').forEach((button) => button.addEventListener('click', () => {
    themeSettings.floating = !themeSettings.floating; selectTheme({ play: true, target: button });
  }));
  themePoints.querySelectorAll('[data-bar-style]').forEach((button) => button.addEventListener('click', () => {
    themeSettings.style = themeSettings.style === 'ios' ? 'default' : 'ios'; selectTheme({ play: true, target: button });
  }));
  themePoints.querySelector('[data-bar-blur]').addEventListener('click', (event) => {
    themeSettings.blur = !themeSettings.blur; selectTheme({ play: true, target: event.currentTarget });
  });
  themePoints.querySelector('[data-bar-top-blur]').addEventListener('click', (event) => {
    themeSettings.topBlur = !themeSettings.topBlur; selectTheme({ play: true, target: event.currentTarget });
  });
  themePoints.querySelector('[data-theme-back]').addEventListener('click', (event) => selectTheme({ play: true, back: true, target: event.currentTarget }));
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
