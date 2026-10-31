(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('[data-header]');
  const imageCache = new Map();
  const players = [];

  const loadImage = (source) => {
    const key = source.src;
    if (!imageCache.has(key)) {
      const image = new Image(source.width ?? 576, source.height ?? 1248);
      image.decoding = 'async'; image.alt = source.alt;
      if (source.srcset) { image.srcset = source.srcset; image.sizes = source.sizes; }
      image.src = source.src;
      imageCache.set(key, image.decode().then(() => image).catch((error) => {
        imageCache.delete(key); throw error;
      }));
    }
    return imageCache.get(key);
  };
  const fadeOut = (element, duration = 220) => {
    if (reducedMotion.matches) { element.remove(); return; }
    element.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: 'ease-out' })
      .finished.then(() => element.remove()).catch(() => element.remove());
  };
  const replaceStill = (current, loaded) => {
    if (current.src === loaded.src) return;
    const next = loaded.cloneNode();
    for (const attribute of current.attributes) {
      if (attribute.name.startsWith('data-')) next.setAttribute(attribute.name, attribute.value);
    }
    const previous = current.cloneNode();
    ['data-showcase-image', 'data-theme-image', 'data-theme-effect'].forEach((name) => previous.removeAttribute(name));
    previous.className = 'screen-overlay'; previous.setAttribute('aria-hidden', 'true');
    current.parentElement.querySelectorAll('.screen-overlay').forEach((element) => element.remove());
    current.replaceWith(next); next.after(previous); fadeOut(previous);
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
    const stop = () => {
      ++request;
      controller?.abort(); controller = null;
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
          sources[index].target().after(video);
          video.addEventListener('error', stop, { once: true });
          video.addEventListener('waiting', () => {
            buffering = true; loaded.forEach((item) => { item.style.opacity = '0'; }); sync();
          });
          video.addEventListener('canplay', () => {
            if (loaded.every((item) => item.readyState >= 3)) {
              buffering = false; loaded.forEach((item) => { item.style.opacity = '1'; }); sync();
            }
          });
          const reveal = () => {
            if (token !== request || buffering) return;
            video.style.opacity = '1';
            if (!reducedMotion.matches) video.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
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
          // Fade into the settled image and dispose of every decoder.
          loaded.forEach((video, index) => {
            if (video.readyState < 2) return;
            const still = document.createElement('canvas');
            still.width = video.videoWidth; still.height = video.videoHeight;
            still.className = 'screen-overlay'; still.setAttribute('aria-hidden', 'true');
            still.getContext('2d').drawImage(video, 0, 0);
            sources[index].target().after(still); fadeOut(still);
          });
          stop();
        }, { once: true });
        ready = true; button.hidden = false; sync();
      } catch { if (token === request) stop(); }
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
  ['demo-visibility-change', 'transitionend'].forEach((event) => document.addEventListener(event, scheduleVisibility));
  document.addEventListener('visibilitychange', checkVisibility);
  window.visualViewport?.addEventListener('resize', scheduleVisibility, { passive: true });
  if (header) new MutationObserver(scheduleVisibility).observe(header, { attributes: true, attributeFilter: ['class'] });

  const tabs = [...document.querySelectorAll('.showcase-tab')];
  const panel = document.querySelector('#screen-panel');
  const points = document.querySelector('[data-screen-points]');
  const playButton = document.querySelector('[data-demo-play]');
  const sceneIds = [
    [null, 'payment-enlarge', 'payment-recharge'],
    ['hall-rooms', 'hall-electricity', 'hall-network'],
    ['bill-filter', 'bill-date', 'bill-stats'],
    ['mine-account', 'mine-profile', 'mine-theme'],
  ];
  let currentTab = -1;
  let pageRequest = 0;
  const pageImage = (index) => ({ src: `assets/${tabs[index].dataset.screen}.webp`,
    srcset: `assets/${tabs[index].dataset.screen}.webp 480w, assets/${tabs[index].dataset.screen}@2x.webp 960w`,
    sizes: '(max-width: 760px) 220px, 268px', width: 480, height: 1041, alt: `财小通${tabs[index].dataset.label}` });
  const pagePlayer = makePlayer([panel, document.querySelector('.showcase-tabs'), document.querySelector('[data-showcase-description]')],
    playButton, (value) => points.querySelector('.is-active')?.style.setProperty('--progress', value));
  const selectPoint = async (index, point) => {
    const token = ++pageRequest;
    pagePlayer.stop();
    const playbackVersion = pagePlayer.version;
    points.querySelectorAll('button').forEach((button, position) => {
      button.classList.toggle('is-active', point === position);
      button.setAttribute('aria-pressed', String(point === position));
    });
    const id = sceneIds[index][point];
    const image = id ? { src: `assets/demos/${id}.webp`, alt: `${tabs[index].dataset.label}：${tabs[index].dataset.points.split('|')[point]}` } : pageImage(index);
    try {
      const loaded = await loadImage(image);
      if (token !== pageRequest) return;
      replaceStill(document.querySelector('[data-showcase-image]'), loaded);
    } catch { /* Keep the complete page available when a preview is unavailable. */ }
    if (token === pageRequest && playbackVersion === pagePlayer.version && id) pagePlayer.start([{ src: `assets/demos/${id}.mp4`, image,
      label: image.alt, target: () => document.querySelector('[data-showcase-image]') }]);
  };
  const selectTab = async (index) => {
    const token = ++pageRequest;
    pagePlayer.stop(); currentTab = index;
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
      if (token === pageRequest) replaceStill(document.querySelector('[data-showcase-image]'), loaded);
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
  const themeScenes = [
    { id: 'floating', label: '悬浮底栏' }, { id: 'style', label: '底栏样式' },
    { id: 'blur', label: '模糊效果' }, { id: 'back', label: '预测性返回' },
  ];
  let themeRequest = 0;
  const themePlayer = makePlayer([themePanel, themePoints], themeButton,
    (value) => themePoints.querySelector('.is-active')?.style.setProperty('--progress', value));
  // The group owns the three videos; their sources and decoders are released together.
  themeButton.parentElement.hidden = false; themeButton.hidden = true;
  const themeSources = (index) => [
    { id: `settings-${themeScenes[index].id}`, selector: '[data-theme-image]', label: `主题设置：${themeScenes[index].label}` },
    ...['light', 'dark'].map((mode) => ({ id: `effect-${themeScenes[index].id}-${mode}`,
      selector: `[data-theme-effect="${mode}"]`, label: `${themeScenes[index].label}：${mode === 'light' ? '浅色' : '深色'}界面` })),
  ].map((source) => ({ src: `assets/demos/${source.id}.mp4`, label: source.label,
    image: { src: `assets/demos/${source.id}.webp`, alt: source.label }, target: () => document.querySelector(source.selector) }));
  const selectTheme = async (index) => {
    const token = ++themeRequest;
    themePlayer.stop();
    const playbackVersion = themePlayer.version;
    themePoints.querySelectorAll('button').forEach((button, position) => {
      button.classList.toggle('is-active', index === position);
      button.setAttribute('aria-pressed', String(index === position));
    });
    const sources = themeSources(index);
    try {
      const images = await Promise.all(sources.map((source) => loadImage(source.image)));
      if (token !== themeRequest) return;
      images.forEach((image, position) => replaceStill(sources[position].target(), image));
    } catch { /* All three static screens remain visible if loading is interrupted. */ }
    if (token === themeRequest && playbackVersion === themePlayer.version) themePlayer.start(sources);
  };
  themePoints.replaceChildren(...themeScenes.map((scene, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'screen-point'; button.textContent = scene.label;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => selectTheme(index));
    li.append(button); return li;
  }));

  // Warm only still images near the modules. Browsing never requests an MP4.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach(({ target }) => {
        const images = target === panel ? tabs.map((_, index) => pageImage(index)) : themeScenes.flatMap((_, index) => themeSources(index).map((source) => source.image));
        images.forEach((source) => loadImage(source).catch(() => {})); observer.unobserve(target);
      });
    }, { rootMargin: '300px' });
    observer.observe(panel); observer.observe(themePanel);
  }
  reducedMotion.addEventListener('change', () => { pagePlayer.stop(); themePlayer.stop(); });
  scheduleVisibility();
})();
