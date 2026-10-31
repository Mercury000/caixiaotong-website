(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('[data-header]');
  const players = [];
  const mediaCache = new Map();

  const loadVideo = (id, label) => {
    if (!mediaCache.has(id)) {
      const video = document.createElement('video');
      Object.assign(video, { muted: true, defaultMuted: true, playsInline: true, preload: 'auto',
        disableRemotePlayback: true, width: 576, height: 1248 });
      video.setAttribute('aria-label', label);
      video.poster = `assets/demos/${id}.webp`;
      const ready = new Promise((resolve, reject) => {
        const done = (error) => {
          clearTimeout(timer);
          video.removeEventListener('loadeddata', loaded);
          video.removeEventListener('error', failed);
          if (error) reject(error); else resolve(video);
        };
        const loaded = () => done();
        const failed = () => done(new Error('Unavailable media'));
        const timer = setTimeout(failed, 15000);
        video.addEventListener('loadeddata', loaded);
        video.addEventListener('error', failed);
        video.src = `assets/demos/${id}.mp4`;
        video.load();
      });
      mediaCache.set(id, ready.catch((error) => { mediaCache.delete(id); throw error; }));
    }
    return mediaCache.get(id);
  };

  const seek = (video, time) => new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < .04 && video.readyState >= 2) { resolve(); return; }
    const finish = () => { clearTimeout(timer); video.removeEventListener('seeked', finish); resolve(); };
    const timer = setTimeout(finish, 2500);
    video.addEventListener('seeked', finish, { once: true });
    video.currentTime = time;
  });

  const setPlayIcon = (button, paused) => {
    const label = paused ? '播放演示' : '暂停演示';
    button?.setAttribute('aria-label', label);
    button?.setAttribute('title', label);
    button?.querySelector('path').setAttribute('d', paused ? 'm7 4 8 6-8 6z' : 'M7 5v10M13 5v10');
  };

  // Visibility includes the controls, not just a corner of a phone behind the fixed header.
  const watchPlayer = (elements, onEnter, onLeave) => {
    const player = { elements, visible: false, timer: 0, onEnter, onLeave };
    players.push(player);
    return player;
  };
  let visibilityFrame = 0;
  const isFullyVisible = (player) => {
    const viewportHeight = window.visualViewport?.height ?? innerHeight;
    const headerBottom = (header?.querySelector('.nav')?.getBoundingClientRect().bottom ?? 0) + 8;
    const rects = player.elements.map((el) => el?.getBoundingClientRect()).filter(Boolean);
    return !document.hidden && !header?.classList.contains('is-menu-open') &&
      Math.min(...rects.map((r) => r.top)) >= headerBottom - 2 &&
      Math.max(...rects.map((r) => r.bottom)) <= viewportHeight - 8;
  };
  const checkVisibility = () => {
    visibilityFrame = 0;
    for (const player of players) {
      const visible = isFullyVisible(player);
      if (visible === player.visible && (visible || !player.timer)) continue;
      clearTimeout(player.timer);
      player.timer = 0;
      if (!visible) {
        player.visible = false;
        player.onLeave();
      } else {
        player.timer = setTimeout(() => {
          player.timer = 0;
          if (!isFullyVisible(player)) return;
          player.visible = true;
          player.onEnter();
        }, 500);
      }
    }
  };
  const scheduleVisibility = () => {
    if (!visibilityFrame) visibilityFrame = requestAnimationFrame(checkVisibility);
  };
  ['scroll', 'resize', 'demo-visibility-change'].forEach((event) =>
    (event === 'scroll' || event === 'resize' ? window : document).addEventListener(event, scheduleVisibility, { passive: true }));
  document.addEventListener('visibilitychange', checkVisibility);
  window.visualViewport?.addEventListener('resize', scheduleVisibility, { passive: true });
  document.addEventListener('transitionend', scheduleVisibility);
  if (header) new MutationObserver(scheduleVisibility).observe(header, { attributes: true, attributeFilter: ['class'] });

  const tabs = [...document.querySelectorAll('.showcase-tab')];
  const panel = document.querySelector('#screen-panel');
  const description = document.querySelector('[data-showcase-description]');
  const points = document.querySelector('[data-screen-points]');
  const playButton = document.querySelector('[data-demo-play]');
  const sceneIds = [
    ['payment-qr', 'payment-barcode', 'payment-recharge'],
    ['hall-rooms', 'hall-electricity', 'hall-network'],
    ['bill-filter', 'bill-date', 'bill-stats'],
    ['mine-account', 'mine-profile', 'mine-theme'],
  ];
  let currentTab = -1;
  let currentChapter = -1;
  let tour;
  let chapters = [];
  let tourPromise;
  let paused = reducedMotion.matches;
  let request = 0;
  let segmentEnd = null;
  let segmentTimer = 0;
  let seeking = false;

  const selectTab = (index, point = -1) => {
    if (currentTab !== index) {
      currentTab = index;
      const tab = tabs[index];
      tabs.forEach((item, i) => {
        item.classList.toggle('is-active', index === i);
        item.setAttribute('aria-selected', String(index === i));
        item.tabIndex = index === i ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', tab.id);
      document.querySelector('[data-screen-title]').textContent = tab.dataset.title;
      document.querySelector('[data-screen-description]').textContent = tab.dataset.description;
      points.replaceChildren(...tab.dataset.points.split('|').map((label, p) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'screen-point'; button.textContent = label;
        button.setAttribute('aria-controls', 'screen-panel');
        button.addEventListener('click', () => selectChapter(sceneIds[index][p]));
        li.append(button); return li;
      }));
      scheduleVisibility();
    }
    points.querySelectorAll('button').forEach((button, i) => {
      button.classList.toggle('is-active', i === point);
      button.setAttribute('aria-pressed', String(i === point));
    });
  };

  const updateChapter = () => {
    if (!tour || seeking) return;
    if (segmentEnd !== null && tour.currentTime >= segmentEnd - .06) {
      const end = segmentEnd;
      paused = true; segmentEnd = null; syncTour();
      if (tour.currentTime > end - .05) seek(tour, end - .05).then(updateChapter);
      return;
    }
    const index = chapters.findLastIndex((chapter, i) => {
      const previous = chapters[i - 1];
      const changingPage = previous && previous.id.split('-')[0] !== chapter.id.split('-')[0];
      return tour.currentTime >= (changingPage ? previous.end : chapter.start);
    });
    const chapter = chapters[Math.max(0, index)];
    if (!chapter) return;
    if (currentChapter !== index) {
      currentChapter = index;
      const tab = sceneIds.findIndex((ids) => ids.includes(chapter.id));
      selectTab(tab, sceneIds[tab].indexOf(chapter.id));
      tour.setAttribute('aria-label', `${tabs[tab].dataset.label}：${tabs[tab].dataset.points.split('|')[sceneIds[tab].indexOf(chapter.id)]}`);
    }
    const end = chapter.end ?? chapters[index + 1]?.start ?? tour.duration;
    points.querySelector('.is-active')?.style.setProperty('--progress',
      Math.min(1, Math.max(0, (tour.currentTime - chapter.start) / (end - chapter.start))));
    if (index === chapters.length - 1 && tour.currentTime >= end && segmentEnd === null) selectTab(0);
  };

  const syncTour = () => {
    clearTimeout(segmentTimer);
    const shouldPlay = mainVisibility.visible && !document.hidden && !paused && !seeking;
    if (tour) {
      if (shouldPlay) {
        tour.play().catch((error) => {
          if (error.name === 'AbortError' || !mainVisibility.visible || document.hidden || seeking) return;
          paused = true; setPlayIcon(playButton, true);
        });
        if (segmentEnd !== null) segmentTimer = setTimeout(() => {
          const end = segmentEnd;
          if (end !== null && tour.currentTime < end - .1) { syncTour(); return; }
          paused = true; segmentEnd = null; syncTour();
          if (end !== null && tour.currentTime > end) seek(tour, end - .05);
        }, Math.max(0, (segmentEnd - tour.currentTime - .04) * 1000));
      }
      else tour.pause();
    }
    setPlayIcon(playButton, !shouldPlay || !tour);
  };

  const prepareTour = () => {
    if (!tourPromise) tourPromise = Promise.all([
      loadVideo('tour', '财小通应用操作演示'),
      fetch('assets/demos/tour.json').then((response) => {
        if (!response.ok) throw new Error('Unavailable chapters');
        return response.json();
      }),
    ]).then(([video, metadata]) => {
      if (!Array.isArray(metadata.chapters) || metadata.chapters.length !== 12) throw new Error('Invalid chapters');
      tour = video; chapters = metadata.chapters;
      tour.dataset.showcaseImage = '';
      document.querySelector('[data-showcase-image]').replaceWith(tour);
      tour.addEventListener('timeupdate', updateChapter);
      tour.addEventListener('play', () => setPlayIcon(playButton, false));
      tour.addEventListener('pause', () => setPlayIcon(playButton, true));
      tour.addEventListener('ended', async () => {
        if (paused) return;
        await seek(tour, 0); currentChapter = -1; updateChapter(); syncTour();
      });
      updateChapter(); syncTour();
      return video;
    }).catch((error) => { tourPromise = null; throw error; });
    return tourPromise;
  };

  const selectChapter = async (id, pageSelection = false) => {
    const token = ++request;
    const previousTab = currentTab;
    paused = true; seeking = true; syncTour();
    if (!tour) {
      const tabIndex = sceneIds.findIndex((ids) => ids.includes(id));
      selectTab(tabIndex, sceneIds[tabIndex].indexOf(id));
      const poster = document.querySelector('img[data-showcase-image]');
      if (poster) {
        poster.src = `assets/${tabs[tabIndex].dataset.screen}.webp`;
        poster.srcset = `assets/${tabs[tabIndex].dataset.screen}.webp 480w, assets/${tabs[tabIndex].dataset.screen}@2x.webp 960w`;
        poster.alt = `财小通${tabs[tabIndex].dataset.label}`;
      }
    }
    let frozenFrame;
    try {
      await prepareTour();
      if (token !== request) return;
      const chapter = chapters.find((entry) => entry.id === id);
      if (!chapter) return;
      if (!reducedMotion.matches && tour.readyState >= 2) {
        panel.querySelectorAll('.screen-exiting').forEach((el) => el.remove());
        frozenFrame = document.createElement('canvas');
        frozenFrame.width = tour.videoWidth; frozenFrame.height = tour.videoHeight;
        frozenFrame.className = 'screen-entering screen-exiting';
        frozenFrame.setAttribute('aria-hidden', 'true');
        frozenFrame.getContext('2d').drawImage(tour, 0, 0);
        tour.after(frozenFrame);
      }
      const end = chapter.end ?? chapters[chapters.indexOf(chapter) + 1]?.start ?? tour.duration;
      const chapterIndex = chapters.indexOf(chapter);
      const targetTab = sceneIds.findIndex((ids) => ids.includes(id));
      const nativeTransition = pageSelection && targetTab === previousTab + 1 && chapterIndex > 0;
      const start = nativeTransition ? chapters[chapterIndex - 1].end : chapter.start;
      await seek(tour, reducedMotion.matches ? Math.min(chapter.start + 2.2, end - .3) : start);
      if (token !== request) return;
      if (frozenFrame) {
        const frame = frozenFrame;
        frame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out' })
          .finished.then(() => frame.remove()).catch(() => frame.remove());
        frozenFrame = null;
      }
      segmentEnd = end;
      currentChapter = -1; seeking = false; updateChapter();
      paused = reducedMotion.matches; syncTour();
    } catch { /* Keep the last complete frame and all controls available. */ }
    finally { frozenFrame?.remove(); if (token === request) { seeking = false; syncTour(); } }
  };

  const mainVisibility = watchPlayer([panel, document.querySelector('.showcase-tabs'), description],
    () => { prepareTour().then(syncTour).catch(() => {}); }, syncTour);
  selectTab(0);
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectChapter(sceneIds[index][0], true));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 :
        (index + (event.key === 'ArrowRight' ? 1 : -1) + 4) % 4;
      tabs[next].focus({ preventScroll: true }); tabs[next].click();
    });
  });
  playButton?.addEventListener('click', async () => {
    paused = Boolean(tour && !tour.paused);
    if (!paused) {
      segmentEnd = null;
      try { await prepareTour(); } catch { paused = true; }
    }
    syncTour();
  });
  description?.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') { paused = true; syncTour(); }
  });

  // The three theme screens keep one clock and stop together when one cannot render.
  const themePanel = document.querySelector('.detail-row__visual--theme');
  const themePoints = document.querySelector('[data-theme-points]');
  const themeButton = document.querySelector('[data-theme-play]');
  const themeScenes = [
    { id: 'floating', label: '悬浮底栏' }, { id: 'style', label: '底栏样式' },
    { id: 'blur', label: '模糊效果' }, { id: 'back', label: '预测性返回' },
  ];
  let themeVideos = [];
  let themeIndex = -1;
  let themeRequest = 0;
  let themePaused = reducedMotion.matches;
  let themeBusy = false;
  let themeBuffering = false;
  let themeManual = false;
  const syncTheme = () => {
    const playing = themeVisibility.visible && !document.hidden && !themePaused && !themeBusy && !themeBuffering;
    themeVideos.forEach((video) => {
      if (playing) video.play().catch((error) => {
        if (error.name === 'AbortError' || !themeVisibility.visible || document.hidden || themeBusy) return;
        themePaused = true; syncTheme();
      });
      else video.pause();
    });
    setPlayIcon(themeButton, !playing || !themeVideos.length);
  };
  const loadTheme = (index) => Promise.all([
    loadVideo(`settings-${themeScenes[index].id}`, '主题设置演示'),
    ...['light', 'dark'].map((mode) => loadVideo(`effect-${themeScenes[index].id}-${mode}`, '主题效果演示')),
  ]);
  const selectTheme = async (startIndex, manual = false) => {
    const token = ++themeRequest;
    themeBusy = true; syncTheme();
    for (let offset = 0; offset < themeScenes.length; offset++) {
      const index = (startIndex + offset) % themeScenes.length;
      try {
        const videos = await loadTheme(index);
        if (token !== themeRequest) return;
        await Promise.all(videos.map((video) => seek(video, reducedMotion.matches ? 2.8 : 0)));
        if (token !== themeRequest) return;
        themeVideos.forEach((video) => video.pause());
        const targets = [document.querySelector('[data-theme-image]'),
          ...['light', 'dark'].map((mode) => document.querySelector(`[data-theme-effect="${mode}"]`))];
        videos.forEach((video, position) => {
          if (position === 0) video.dataset.themeImage = '';
          else video.dataset.themeEffect = position === 1 ? 'light' : 'dark';
          if (targets[position] !== video) targets[position].replaceWith(video);
          if (!video.dataset.bound) {
            video.dataset.bound = 'true';
            video.addEventListener('waiting', () => {
              if (themeVideos.includes(video)) { themeBuffering = true; syncTheme(); }
            });
            video.addEventListener('canplay', () => {
              if (themeVideos.every((v) => v.readyState >= 3)) { themeBuffering = false; syncTheme(); }
            });
          }
        });
        themeVideos = videos; themeIndex = index; themeManual = manual;
        themeBusy = false; themeBuffering = false;
        if (manual) themePaused = reducedMotion.matches;
        const master = videos[0];
        master.ontimeupdate = () => {
          if (master !== themeVideos[0]) return;
          themePoints.querySelector('.is-active')?.style.setProperty('--progress', master.currentTime / master.duration);
          themeVideos.slice(1).forEach((video) => {
            if (Math.abs(video.currentTime - master.currentTime) > .12 && !video.seeking) video.currentTime = master.currentTime;
          });
        };
        master.onended = () => {
          if (master !== themeVideos[0]) return;
          if (themeManual) { themePaused = true; syncTheme(); }
          else if (themeVisibility.visible && !themePaused) selectTheme((index + 1) % 4);
        };
        themePoints.querySelectorAll('button').forEach((button, i) => {
          button.classList.toggle('is-active', index === i);
          button.setAttribute('aria-pressed', String(index === i));
          button.style.setProperty('--progress', 0);
        });
        document.querySelector('[data-theme-controls]').hidden = false;
        syncTheme();
        if (themeVisibility.visible && !themePaused) loadTheme((index + 1) % 4).catch(() => {});
        return;
      } catch { /* Skip missing scenes without showing a failure message. */ }
    }
    if (token === themeRequest) { themeBusy = false; syncTheme(); }
  };
  const themeVisibility = watchPlayer([themePanel, themePoints], () => {
    if (!themeVideos.length) selectTheme(0);
    else if (themeVideos[0].ended && !themePaused) selectTheme((themeIndex + 1) % 4);
    else syncTheme();
  }, syncTheme);
  themePoints?.replaceChildren(...themeScenes.map((scene, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'screen-point'; button.textContent = scene.label;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => selectTheme(index, true));
    li.append(button); return li;
  }));
  themeButton?.addEventListener('click', () => {
    themePaused = Boolean(themeVideos[0] && !themeVideos[0].paused);
    if (!themePaused && themeVideos[0]?.ended) selectTheme(themeIndex);
    else syncTheme();
  });

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) { paused = true; themePaused = true; syncTour(); syncTheme(); }
  });
  // Warm the one continuous movie near the section; loading never starts playback.
  if ('IntersectionObserver' in window && panel) {
    const preloadObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        prepareTour().catch(() => {}); preloadObserver.disconnect();
      }
    }, { rootMargin: '300px' });
    preloadObserver.observe(panel);
  }
  scheduleVisibility();
})();
