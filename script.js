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
  header?.classList.toggle('is-menu-open', open);
  navToggle?.setAttribute('aria-expanded', String(open));
  navToggle?.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
};

navToggle?.addEventListener('click', () => {
  setNavigationOpen(navToggle.getAttribute('aria-expanded') !== 'true');
});
navLinks?.addEventListener('click', (event) => {
  if (event.target.closest('a')) setNavigationOpen(false);
});
document.addEventListener('click', (event) => {
  if (!header?.contains(event.target)) setNavigationOpen(false);
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
const screen = document.querySelector('[data-showcase-image]');
const showcasePhone = document.querySelector('.phone--showcase');
let swapTimer;

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    if (tab.classList.contains('is-active') || !screen) return;

    tabs.forEach((item) => {
      const isCurrent = item === tab;
      item.classList.toggle('is-active', isCurrent);
      item.setAttribute('aria-selected', String(isCurrent));
    });

    clearTimeout(swapTimer);
    showcasePhone?.classList.add('is-changing');
    swapTimer = setTimeout(() => {
      screen.src = `assets/${tab.dataset.screen}`;
      screen.alt = `财小通${tab.dataset.label}预览，数据均为虚构`;
      requestAnimationFrame(() => showcasePhone?.classList.remove('is-changing'));
    }, prefersReducedMotion ? 0 : 180);
  });
});
