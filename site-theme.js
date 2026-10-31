(() => {
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) root.classList.add('entrance-ready');
  let preference;
  try { preference = localStorage.getItem('cxt-color-mode'); } catch { /* System preference works without storage. */ }
  const apply = (mode) => {
    root.dataset.theme = mode;
    document.querySelector('meta[name="theme-color"]').content = mode === 'dark' ? '#101319' : '#f5f5f7';
    const button = document.querySelector('[data-site-theme]');
    const label = mode === 'dark' ? '切换浅色模式' : '切换深色模式';
    button?.setAttribute('aria-label', label); button?.setAttribute('title', label);
    document.querySelectorAll('[data-theme-picture]').forEach((picture) => {
      picture.querySelector('source').media = mode === 'dark' ? 'all' : 'not all';
    });
    document.dispatchEvent(new Event('site-theme-change'));
  };
  apply(preference === 'light' || preference === 'dark' ? preference : system.matches ? 'dark' : 'light');
  system.addEventListener('change', () => {
    if (preference !== 'light' && preference !== 'dark') apply(system.matches ? 'dark' : 'light');
  });
  document.addEventListener('readystatechange', () => {
    if (document.readyState === 'interactive') apply(root.dataset.theme);
  });
  document.addEventListener('DOMContentLoaded', () => {
    root.classList.remove('entrance-ready');
    apply(root.dataset.theme);
    document.querySelector('[data-site-theme]').addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('cxt-color-mode', preference); } catch { /* The selection still works for this visit. */ }
      apply(preference);
    });
  });
})();
