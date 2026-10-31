(() => {
  const watched = new WeakSet();
  const versions = new WeakMap();
  const settle = (image) => {
    const version = (versions.get(image) ?? 0) + 1;
    versions.set(image, version);
    image.decode().then(() => {
      if (versions.get(image) === version && image.naturalWidth) image.classList.add('is-ready');
    }).catch(() => {
      if (versions.get(image) === version) image.classList.remove('is-ready');
    });
  };
  const watch = (image) => {
    if (watched.has(image)) return;
    watched.add(image);
    image.addEventListener('load', () => settle(image));
    image.addEventListener('error', () => {
      versions.set(image, (versions.get(image) ?? 0) + 1);
      image.classList.remove('is-ready');
    });
    settle(image);
  };
  const scan = (element) => {
    if (!(element instanceof Element)) return;
    if (element.matches('img[data-media-image]')) watch(element);
    element.querySelectorAll('img[data-media-image]').forEach(watch);
  };
  scan(document.documentElement);
  new MutationObserver((records) => records.forEach((record) => {
    if (record.type === 'childList') record.addedNodes.forEach(scan);
    else {
      const image = record.target.tagName === 'SOURCE' ? record.target.parentElement.querySelector('img') : record.target;
      if (image?.matches('img[data-media-image]')) {
        image.classList.remove('is-ready');
        settle(image);
      }
    }
  })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset', 'media'] });
})();
