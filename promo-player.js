(() => {
  const opener = document.querySelector('[data-promo-open]');
  const dialog = document.querySelector('#promo-dialog');
  const video = document.querySelector('[data-promo-video]');
  const visibilityChanged = () => document.dispatchEvent(new Event('demo-visibility-change'));
  video.addEventListener('loadeddata', () => video.classList.add('is-ready'));
  video.addEventListener('error', () => video.classList.remove('is-ready'));

  opener?.addEventListener('click', () => {
    if (!video.hasAttribute('src')) {
      video.poster = video.dataset.poster;
      const poster = new Image();
      poster.src = video.dataset.poster;
      poster.decode().then(() => { if (!video.error) video.classList.add('is-ready'); }).catch(() => {});
      video.src = video.dataset.src;
      video.load();
    }
    if (video.ended) video.currentTime = 0;
    dialog.showModal();
    document.documentElement.classList.add('is-promo-open');
    visibilityChanged();
    video.play().catch(() => {});
  });
  dialog?.querySelector('[data-promo-close]').addEventListener('click', () => dialog.close());
  dialog?.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog?.addEventListener('close', () => {
    video.pause();
    document.documentElement.classList.remove('is-promo-open');
    visibilityChanged();
    opener.focus({ preventScroll: true });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
})();
