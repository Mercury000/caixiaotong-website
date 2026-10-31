const header = document.querySelector('[data-header]');
const reveals = document.querySelectorAll('.reveal');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 18);
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const navToggle = document.querySelector('[data-nav-toggle]');
const navLinks = document.querySelector('.nav__links');
const mobileNavigation = window.matchMedia('(max-width: 760px)');
const setNavigationOpen = (open) => {
  const isOpen = open && mobileNavigation.matches;
  if (!isOpen && mobileNavigation.matches && navLinks?.contains(document.activeElement)) {
    navToggle?.focus({ preventScroll: true });
  }
  header?.classList.toggle('is-menu-open', isOpen);
  navToggle?.setAttribute('aria-expanded', String(isOpen));
  navToggle?.setAttribute('aria-label', isOpen ? '关闭导航' : '打开导航');
  if (navLinks) navLinks.inert = mobileNavigation.matches && !isOpen;
};
setNavigationOpen(false);

navToggle?.addEventListener('click', (event) => {
  const open = navToggle.getAttribute('aria-expanded') !== 'true';
  setNavigationOpen(open);
  if (open && event.detail === 0) navLinks?.querySelector('a')?.focus({ preventScroll: true });
});
header?.addEventListener('click', (event) => {
  if (event.target.closest('a')) setNavigationOpen(false);
});
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-nav-backdrop]') || !header?.contains(event.target)) {
    setNavigationOpen(false);
  }
});
header?.addEventListener('focusout', (event) => {
  if (event.relatedTarget && !header.contains(event.relatedTarget)) setNavigationOpen(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navToggle?.getAttribute('aria-expanded') === 'true') {
    setNavigationOpen(false);
    navToggle.focus();
  }
});
mobileNavigation.addEventListener('change', () => setNavigationOpen(false));

const featureCards = document.querySelectorAll('.feature-card');
if ('IntersectionObserver' in window && !prefersReducedMotion) {
  const featureObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.target.classList.toggle('is-animated', entry.isIntersecting));
  }, { threshold: 0.15 });
  featureCards.forEach((card) => featureObserver.observe(card));
} else if (!prefersReducedMotion) {
  featureCards.forEach((card) => card.classList.add('is-animated'));
}

if ('IntersectionObserver' in window && !prefersReducedMotion) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -35px' });
  document.documentElement.classList.add('motion-ready');
  reveals.forEach((element) => observer.observe(element));
} else {
  reveals.forEach((element) => element.classList.add('is-visible'));
}

const tiltStage = document.querySelector('[data-tilt]');
if (tiltStage && !prefersReducedMotion && window.matchMedia('(pointer: fine)').matches) {
  tiltStage.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || window.innerWidth <= 980) return;
    const bounds = tiltStage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    tiltStage.style.transform = `perspective(1200px) rotateX(${-y * 3}deg) rotateY(${x * 4}deg)`;
  });
  tiltStage.addEventListener('pointerleave', () => {
    tiltStage.style.transform = '';
  });
}

const tabs = [...document.querySelectorAll('.showcase-tab')];
let screen = document.querySelector('[data-showcase-image]');
const screenPanel = document.querySelector('#screen-panel');
const screenTitle = document.querySelector('[data-screen-title]');
const screenDescription = document.querySelector('[data-screen-description]');
const screenPoints = document.querySelector('[data-screen-points]');
const demoControls = document.querySelector('[data-demo-controls]');
const playButton = document.querySelector('[data-demo-play]');
const sceneIds = {
  'payment-light': ['payment-qr', 'payment-barcode', 'payment-recharge'],
  'hall-light': ['hall-rooms', 'hall-electricity', 'hall-network'],
  'bill-light': ['bill-filter', 'bill-date', 'bill-stats'],
  'mine-light': ['mine-account', 'mine-profile', 'mine-theme'],
};
const playlist = tabs.flatMap((tab) => sceneIds[tab.dataset.screen].map((id, point) => ({ tab, id, point })));
const mediaCache = new Map();
let selectedTab = tabs[0];
let selectedIndex = -1;
let switchRequest = 0;
let inView = false;
let initialized = false;
let userPaused = prefersReducedMotion;

const updatePlayButton = () => {
  const paused = userPaused || screen?.tagName !== 'VIDEO' || screen.paused;
  const label = paused ? '继续自动播放' : '暂停自动播放';
  playButton?.setAttribute('aria-label', label);
  playButton?.setAttribute('title', label);
  playButton?.querySelector('path').setAttribute('d', paused ? 'm7 4 8 6-8 6z' : 'M7 5v10M13 5v10');
};

const syncPlayback = () => {
  if (screen?.tagName !== 'VIDEO') return;
  if (inView && !document.hidden && !userPaused) {
    const video = screen;
    video.play().catch((error) => {
      if (video === screen && video.paused && error.name !== 'AbortError') {
        userPaused = true;
        updatePlayButton();
      }
    });
  } else {
    screen.pause();
  }
  updatePlayButton();
};

const updateProgress = (video) => {
  if (video !== screen || !Number.isFinite(video.duration)) return;
  screenPoints?.querySelector('.is-active')?.style.setProperty('--progress', video.currentTime / video.duration);
};

const loadMedia = (tab, scene, namespace = '') => {
  const key = namespace + (scene?.id ?? tab.dataset.screen);
  if (!mediaCache.has(key)) {
    let ready;
    if (scene) {
      const video = document.createElement('video');
      video.dataset.showcaseImage = '';
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.disableRemotePlayback = true;
      video.width = 576;
      video.height = 1248;
      video.setAttribute('aria-label', `财小通${tab.dataset.label}：${scene.label ?? tab.dataset.points.split('|')[scene.point]}`);
      video.poster = `assets/demos/${scene.id}.webp`;
      ready = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          video.removeAttribute('src');
          video.load();
          reject(new Error('Media timeout'));
        }, 12000);
        video.addEventListener('loadeddata', () => { clearTimeout(timeout); resolve(video); }, { once: true });
        video.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Media unavailable')); }, { once: true });
        video.src = `assets/demos/${scene.id}.mp4`;
        video.load();
      });
      video.addEventListener('play', updatePlayButton);
      video.addEventListener('pause', updatePlayButton);
      video.addEventListener('timeupdate', () => updateProgress(video));
      video.addEventListener('ended', () => {
        if (video === screen && inView && !document.hidden && !userPaused) playSequence((selectedIndex + 1) % playlist.length);
      });
    } else {
      const image = new Image(480, 1041);
      image.dataset.showcaseImage = '';
      image.decoding = 'async';
      image.sizes = '(max-width: 760px) 250px, 285px';
      image.srcset = `assets/${key}.webp 480w, assets/${key}@2x.webp 960w`;
      image.alt = `财小通${tab.dataset.label}`;
      image.src = `assets/${key}.webp`;
      ready = image.decode().then(() => image);
    }
    mediaCache.set(key, ready.catch((error) => { mediaCache.delete(key); throw error; }));
  }
  return mediaCache.get(key);
};

const updateTab = (tab, scene) => {
  const tabChanged = selectedTab !== tab;
  selectedTab = tab;
  tabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
  });
  screenPanel?.setAttribute('aria-labelledby', tab.id);
  if (screenTitle) screenTitle.textContent = tab.dataset.title;
  if (screenDescription) screenDescription.textContent = tab.dataset.description;
  if (tabChanged || !screenPoints?.querySelector('button')) {
    screenPoints?.replaceChildren(...tab.dataset.points.split('|').map((label, point) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'screen-point';
      button.textContent = label;
      button.setAttribute('aria-controls', 'screen-panel');
      button.addEventListener('click', () => {
        initialized = true;
        playSequence(playlist.findIndex((entry) => entry.tab === tab && entry.point === point), true);
      });
      item.append(button);
      return item;
    }));
  }
  screenPoints?.querySelectorAll('button').forEach((button, point) => {
    const active = point === scene?.point;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.style.setProperty('--progress', 0);
  });
};

const showMedia = async (media, tab, scene, request) => {
  if (request !== switchRequest) return false;
  if (media !== screen) {
    const previous = screen;
    previous.parentElement.querySelectorAll('.screen-exiting').forEach((item) => item.remove());
    previous.getAnimations().forEach((animation) => animation.cancel());
    previous.classList.remove('screen-entering');
    if (screen.tagName === 'VIDEO') screen.pause();
    media.dataset.showcaseImage = '';
    media.removeAttribute('aria-hidden');
    media.classList.remove('screen-exiting', 'screen-entering');
    if (!prefersReducedMotion && media.animate) {
      previous.removeAttribute('data-showcase-image');
      previous.setAttribute('aria-hidden', 'true');
      previous.classList.add('screen-exiting');
      media.classList.add('screen-entering');
      previous.after(media);
      media.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' }).finished.then(() => {
        previous.remove();
        media.classList.remove('screen-entering');
      }).catch(() => {});
    } else {
      previous.replaceWith(media);
    }
    screen = media;
  }
  updateTab(tab, scene);
  if (demoControls) demoControls.hidden = !scene;
  return true;
};

async function playSequence(startIndex, manual = false) {
  if (!screen || !playlist.length) return;
  const request = ++switchRequest;
  if (manual && screen.tagName === 'VIDEO') screen.pause();
  const first = playlist[startIndex];
  // Keep a complete page visible while a manually selected demo becomes ready.
  if (manual && first.tab !== selectedTab) {
    try {
      const image = await loadMedia(first.tab);
      if (!await showMedia(image, first.tab, null, request)) return;
      selectedIndex = startIndex - 1;
    } catch { /* Preserve the current frame when an asset is unavailable. */ }
  }
  const attempts = manual ? 1 : playlist.length;
  for (let offset = 0; offset < attempts; offset++) {
    if (request !== switchRequest) return;
    const index = (startIndex + offset) % playlist.length;
    const scene = playlist[index];
    try {
      const video = await loadMedia(scene.tab, scene);
      if (!await showMedia(video, scene.tab, scene, request)) return;
      selectedIndex = index;
      video.currentTime = prefersReducedMotion && userPaused ? Math.min(1.8, video.duration / 2) : 0;
      syncPlayback();
      // Prepare only the following clip; downloading the whole gallery is unnecessary.
      const next = playlist[(index + 1) % playlist.length];
      if (!userPaused) loadMedia(next.tab, next).catch(() => {});
      return;
    } catch { /* Skip unavailable clips quietly, without replacing the visible media. */ }
  }
  updatePlayButton();
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    initialized = true;
    playSequence(playlist.findIndex((scene) => scene.tab === tab), true);
  });
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus({ preventScroll: true });
    tabs[next].click();
  });
});

playButton?.addEventListener('click', () => {
  userPaused = !userPaused;
  if (!userPaused && screen?.ended) playSequence((selectedIndex + 1) % playlist.length);
  else syncPlayback();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && inView && !userPaused && screen?.ended) playSequence((selectedIndex + 1) % playlist.length);
  else syncPlayback();
});

updateTab(selectedTab, null);
if ('IntersectionObserver' in window && screenPanel) {
  const previewObserver = new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting);
    if (inView && !initialized) {
      initialized = true;
      playSequence(0);
    } else if (inView && !userPaused && screen?.ended) {
      playSequence((selectedIndex + 1) % playlist.length);
    }
    syncPlayback();
  }, { threshold: 0.15 });
  previewObserver.observe(screenPanel);
} else {
  inView = true;
  initialized = true;
  playSequence(0);
}

// Each theme scene contains a fixed light settings render and matching light/dark app renders.
const themePanel = document.querySelector('.detail-row__visual--theme');
let themeScreen = document.querySelector('[data-theme-image]');
const themePoints = document.querySelector('[data-theme-points]');
const themeControl = document.querySelector('[data-theme-play]');
const themeScenes = [
  { id: 'settings-floating', effect: 'floating', label: '悬浮底栏' },
  { id: 'settings-style', effect: 'style', label: '底栏样式' },
  { id: 'settings-blur', effect: 'blur', label: '模糊效果' },
  { id: 'settings-back', effect: 'back', label: '预测性返回' },
];
let themeVideos = [];
let themeIndex = -1;
let themeRequest = 0;
let themeInView = false;
let themePaused = prefersReducedMotion;
let themeInitialized = false;

const loadThemeScene = (scene) => Promise.all([
  loadMedia(tabs[3], scene, 'theme:'),
  ...['light', 'dark'].map((mode) => loadMedia(tabs[3], { id: `effect-${scene.effect}-${mode}`, label: `${scene.label}效果` }, 'theme:')),
]);

const syncThemePlayback = () => {
  if (!themeVideos.length) return;
  const paused = themePaused || !themeInView || document.hidden;
  const label = themePaused ? '继续主题演示' : '暂停主题演示';
  themeControl?.setAttribute('aria-label', label);
  themeControl?.setAttribute('title', label);
  themeControl?.querySelector('path').setAttribute('d', themePaused ? 'm7 4 8 6-8 6z' : 'M7 5v10M13 5v10');
  if (paused) themeVideos.forEach((video) => video.pause());
  else {
    const videos = themeVideos;
    Promise.all(videos.map((video) => video.play())).catch((error) => {
      if (videos === themeVideos && error.name !== 'AbortError') {
        themePaused = true;
        syncThemePlayback();
      }
    });
  }
};

const selectThemeScene = async (startIndex) => {
  const request = ++themeRequest;
  for (let offset = 0; offset < themeScenes.length; offset++) {
    if (request !== themeRequest) return;
    const index = (startIndex + offset) % themeScenes.length;
    const scene = themeScenes[index];
    try {
      const videos = await loadThemeScene(scene);
      if (request !== themeRequest) return;
      themeVideos.forEach((video) => video.pause());
      const targets = [themeScreen, ...['light', 'dark'].map((mode) => document.querySelector(`[data-theme-effect="${mode}"]`))];
      videos.forEach((video, position) => {
        video.removeAttribute('data-showcase-image');
        if (!position) video.dataset.themeImage = '';
        else video.dataset.themeEffect = position === 1 ? 'light' : 'dark';
        if (video !== targets[position]) targets[position].replaceWith(video);
        video.currentTime = prefersReducedMotion && themePaused ? Math.min(2.8, video.duration / 2) : 0;
      });
      themeVideos = videos;
      themeScreen = videos[0];
      themeIndex = index;
      if (!themeScreen.dataset.themeBound) {
        const master = themeScreen;
        master.dataset.themeBound = '';
        master.addEventListener('ended', () => {
          if (master === themeScreen && themeInView && !document.hidden && !themePaused) selectThemeScene((themeIndex + 1) % themeScenes.length);
        });
        master.addEventListener('timeupdate', () => {
          if (master !== themeScreen || !Number.isFinite(master.duration)) return;
          themePoints?.querySelector('.is-active')?.style.setProperty('--progress', master.currentTime / master.duration);
          themeVideos.slice(1).forEach((video) => {
            if (Math.abs(video.currentTime - master.currentTime) > .18) video.currentTime = master.currentTime;
          });
        });
      }
      themePoints?.querySelectorAll('button').forEach((button, point) => {
        const active = point === index;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
        button.style.setProperty('--progress', 0);
      });
      const controls = document.querySelector('[data-theme-controls]');
      if (controls) controls.hidden = false;
      syncThemePlayback();
      if (!themePaused) loadThemeScene(themeScenes[(index + 1) % themeScenes.length]).catch(() => {});
      return;
    } catch { /* Retain all three ready interfaces when any scene asset is unavailable. */ }
  }
};

if (themeScreen && themePoints) {
  themePoints.replaceChildren(...themeScenes.map((scene, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'screen-point';
    button.textContent = scene.label;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => { themeInitialized = true; selectThemeScene(index); });
    item.append(button);
    return item;
  }));
  themeControl?.addEventListener('click', () => {
    themePaused = !themePaused;
    if (!themePaused && themeScreen?.ended) selectThemeScene((themeIndex + 1) % themeScenes.length);
    else syncThemePlayback();
  });
  document.addEventListener('visibilitychange', syncThemePlayback);
  if ('IntersectionObserver' in window) {
    const themeObserver = new IntersectionObserver((entries) => {
      themeInView = entries.some((entry) => entry.isIntersecting);
      if (themeInView && !themeInitialized) {
        themeInitialized = true;
        selectThemeScene(0);
      } else if (themeInView && !themePaused && themeScreen?.ended) selectThemeScene((themeIndex + 1) % themeScenes.length);
      syncThemePlayback();
    }, { threshold: 0.15 });
    themeObserver.observe(themePanel);
  } else {
    themeInView = true;
    selectThemeScene(0);
  }
}
