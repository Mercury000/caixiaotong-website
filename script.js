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

// Older browsers keep ordinary navigation, with the same brief fade on departure.
if (!('onpageswap' in window) && !prefersReducedMotion) {
  let leavingPage = false;
  let departure;
  document.addEventListener('click', async (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || matchMedia('(prefers-reduced-motion: reduce)').matches || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || destination.pathname === location.pathname || !/\/(?:index|download)\.html$/.test(destination.pathname)) return;
    const main = document.querySelector('main');
    if (!main?.animate) return;
    event.preventDefault();
    if (leavingPage) return;
    leavingPage = true;
    departure = main.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
    try { await departure.finished; } catch { return; }
    location.assign(destination.href);
  });
  window.addEventListener('pageshow', () => { departure?.cancel(); leavingPage = false; });
}

const featureCards = document.querySelectorAll('.feature-card');
if ('IntersectionObserver' in window && !prefersReducedMotion) {
  const featureObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.target.classList.toggle('is-animated', entry.isIntersecting && entry.intersectionRatio >= .65));
  }, { threshold: [0, .65], rootMargin: '-80px 0px -20px' });
  featureCards.forEach((card) => featureObserver.observe(card));
} else if (!prefersReducedMotion) {
  featureCards.forEach((card) => card.classList.add('is-animated'));
}

if ('IntersectionObserver' in window && !prefersReducedMotion) {
  const inset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  let revealScroll = scrollY;
  let revealDirection = 1;
  window.addEventListener('scroll', () => {
    if (scrollY !== revealScroll) revealDirection = Math.sign(scrollY - revealScroll);
    revealScroll = scrollY;
  }, { passive: true });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.intersectionRatio < .2 || entry.target.classList.contains('is-visible')) return;
      entry.target.style.setProperty('--reveal-distance', revealDirection < 0 ? '-20px' : '28px');
      entry.target.classList.add('is-visible');
    });
  }, { threshold: [0, .2], rootMargin: `-${inset + 24}px 0px -48px` });
  // Reset only after the entire element leaves the reading area.
  const resetObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) entry.target.classList.remove('is-visible');
    });
  }, { rootMargin: `-${inset}px 0px 0px` });
  document.documentElement.classList.add('motion-ready');
  reveals.forEach((element) => { observer.observe(element); resetObserver.observe(element); });
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
