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
    entries.forEach((entry) => entry.target.classList.toggle('is-animated', entry.isIntersecting && entry.intersectionRatio >= .65));
  }, { threshold: [0, .65], rootMargin: '-80px 0px -20px' });
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
