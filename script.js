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

if ('IntersectionObserver' in window && !prefersReducedMotion) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -35px' });
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

const tabs = document.querySelectorAll('.showcase-tab');
let screen = document.querySelector('[data-showcase-image]');
const showcasePhone = document.querySelector('.phone--showcase');
const showcaseStatus = document.querySelector('[data-showcase-status]');
const screenCache = new Map();
let switchRequest = 0;
let swapTimer;

const loadShowcaseImage = (tab) => {
  const file = tab.dataset.screen;
  if (!screenCache.has(file)) {
    const image = new Image();
    image.dataset.showcaseImage = '';
    image.decoding = 'async';
    image.alt = `财小通${tab.dataset.label}预览，数据均为虚构`;
    image.src = `assets/${file}`;
    const ready = image.decode().then(() => image).catch((error) => {
      screenCache.delete(file);
      throw error;
    });
    screenCache.set(file, ready);
  }
  return screenCache.get(file);
};

const clearShowcaseLoading = () => {
  showcasePhone?.setAttribute('aria-busy', 'false');
  if (showcaseStatus) showcaseStatus.textContent = '';
};

tabs.forEach((tab) => {
  tab.addEventListener('click', async () => {
    if (!screen) return;
    const request = ++switchRequest;
    clearTimeout(swapTimer);
    showcasePhone?.classList.remove('is-changing');
    clearShowcaseLoading();
    if (tab.classList.contains('is-active')) return;

    showcasePhone?.setAttribute('aria-busy', 'true');
    if (showcaseStatus) showcaseStatus.textContent = `正在加载${tab.dataset.label}…`;

    try {
      // Keep the visible image and selected tab together until decoding finishes.
      const image = await loadShowcaseImage(tab);
      if (request !== switchRequest) return;
      showcasePhone?.classList.add('is-changing');
      swapTimer = setTimeout(() => {
        if (request !== switchRequest) return;
        // Insert the decoded element itself so a new src cannot show the old frame.
        screen.replaceWith(image);
        screen = image;
        tabs.forEach((item) => {
          const isCurrent = item === tab;
          item.classList.toggle('is-active', isCurrent);
          item.setAttribute('aria-selected', String(isCurrent));
        });
        clearShowcaseLoading();
        requestAnimationFrame(() => {
          if (request === switchRequest) showcasePhone?.classList.remove('is-changing');
        });
      }, prefersReducedMotion ? 0 : 180);
    } catch {
      if (request !== switchRequest) return;
      clearShowcaseLoading();
      if (showcaseStatus) showcaseStatus.textContent = '图片加载失败，请点击页面标签重试。';
    }
  });
});

if (screen && 'IntersectionObserver' in window) {
  const preloadObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    tabs.forEach((tab) => loadShowcaseImage(tab).catch(() => {}));
    preloadObserver.disconnect();
  }, { rootMargin: '350px' });
  preloadObserver.observe(document.querySelector('#experience'));
}
