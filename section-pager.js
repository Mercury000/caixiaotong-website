(() => {
  const desktop = matchMedia('(min-width: 1101px) and (min-height: 700px) and (hover: hover) and (pointer: fine)');
  const touch = matchMedia('(pointer: coarse)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const explicitSections = [...document.querySelectorAll('[data-page-section]')];
  const sections = explicitSections.length ? explicitSections : [...document.querySelectorAll('.hero, .showcase, #features, .detail-row, .download-section, .footer')];
  if (sections.length < 2) return;
  let lastWheel = 0;
  let wheelDistance = 0;
  let gestureUsed = false;
  let animationFrame = 0;
  let moving = false;
  let touchGesture;

  const reset = () => {
    cancelAnimationFrame(animationFrame);
    moving = false; lastWheel = 0; wheelDistance = 0; gestureUsed = false; touchGesture = null;
  };
  const enabled = () => (desktop.matches || touch.matches) && !reducedMotion.matches &&
    !document.querySelector('dialog[open]') &&
    (window.visualViewport?.scale ?? 1) <= 1.02;
  const layoutTop = (element) => {
    let top = 0;
    for (let parent = element; parent; parent = parent.offsetParent) top += parent.offsetTop;
    return top;
  };
  const positions = () => {
    const inset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const limit = document.documentElement.scrollHeight - innerHeight;
    return sections.map((section, index) => {
      const top = layoutTop(section);
      const start = index === 0 && explicitSections.length ? 0 : Math.max(0, Math.min(limit, top - inset));
      const room = innerHeight - (top - start);
      // Read oversized content before leaving its module.
      const content = section.querySelector('.showcase__inner, .detail-row__visual--theme') ?? section;
      const bottom = layoutTop(content) + content.offsetHeight;
      const end = section.offsetHeight <= room + 4 ? start : Math.min(limit, bottom - innerHeight + 16);
      return { start, end: Math.max(start, end) };
    }).filter((position, index, all) => index === 0 || position.start > all[index - 1].start + 1);
  };
  const targetFor = (direction, y = scrollY) => {
    const pages = positions();
    const index = Math.max(0, pages.findLastIndex((page) => page.start <= y + 8));
    const page = pages[index];
    const step = innerHeight - (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
    let target;
    if (direction > 0) {
      target = y < page.end - 8 ? Math.min(y + step, page.end) : pages[index + 1]?.start;
    } else {
      target = y > page.start + 8 ? Math.max(y - step, page.start) : pages[index - 1]?.end;
    }
    return target;
  };
  const scrollToTarget = (target) => {
    if (moving || target === undefined || Math.abs(target - scrollY) < 2) return;
    moving = true;
    const started = performance.now();
    scrollTo({ top: target, behavior: 'smooth' });
    let settled = 0;
    const finish = () => {
      settled = Math.abs(scrollY - target) < 2 ? settled + 1 : 0;
      if (settled >= 3 || performance.now() - started > 1600) { moving = false; return; }
      animationFrame = requestAnimationFrame(finish);
    };
    animationFrame = requestAnimationFrame(finish);
  };
  const move = (direction) => scrollToTarget(targetFor(direction));
  const nestedScrollCanMove = (event, direction) => event.composedPath().some((element) => {
    if (!(element instanceof Element) || element === document.body || element === document.documentElement) return false;
    if (!/(auto|scroll)/.test(getComputedStyle(element).overflowY)) return false;
    return direction > 0 ? element.scrollTop + element.clientHeight < element.scrollHeight - 1 : element.scrollTop > 1;
  });

  window.addEventListener('wheel', (event) => {
    if (!enabled() || event.ctrlKey || event.defaultPrevented || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    const direction = Math.sign(event.deltaY);
    if (nestedScrollCanMove(event, direction)) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheel > 220) { wheelDistance = 0; gestureUsed = false; }
    lastWheel = now;
    // A touchpad's momentum belongs to the gesture that already changed the page.
    if (moving) { gestureUsed = true; return; }
    if (gestureUsed) return;
    if (Math.sign(wheelDistance) !== direction) wheelDistance = 0;
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    wheelDistance += event.deltaY * scale;
    if (Math.abs(wheelDistance) < 24) return;
    gestureUsed = true;
    move(direction);
  }, { passive: false });

  window.addEventListener('touchstart', (event) => {
    if (!enabled() || event.touches.length !== 1) { touchGesture = null; return; }
    const finger = event.touches[0];
    touchGesture = { x: finger.clientX, y: finger.clientY, start: scrollY, delta: 0,
      previous: targetFor(-1) ?? scrollY, next: targetFor(1) ?? scrollY,
      vertical: false, bypass: false, blocked: moving };
  }, { passive: true });
  window.addEventListener('touchmove', (event) => {
    const gesture = touchGesture;
    if (!gesture || !enabled() || gesture.bypass || event.touches.length !== 1) return;
    const dx = gesture.x - event.touches[0].clientX;
    const dy = gesture.y - event.touches[0].clientY;
    if (!gesture.vertical) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      if (Math.abs(dx) > Math.abs(dy) || nestedScrollCanMove(event, Math.sign(dy))) {
        gesture.bypass = true; return;
      }
      gesture.vertical = true;
    }
    if (!event.cancelable) { gesture.bypass = true; return; }
    event.preventDefault();
    if (gesture.blocked) return;
    gesture.delta = dy;
    // Follow the finger, then settle into one module on release without native momentum.
    scrollTo({ top: Math.min(gesture.next, Math.max(gesture.previous, gesture.start + dy)), behavior: 'instant' });
  }, { passive: false });
  const finishTouch = (cancelled) => {
    const gesture = touchGesture;
    touchGesture = null;
    if (!gesture?.vertical || gesture.bypass || gesture.blocked) return;
    const target = !cancelled && Math.abs(gesture.delta) >= 32 ?
      gesture.delta > 0 ? gesture.next : gesture.previous : gesture.start;
    scrollToTarget(target);
  };
  window.addEventListener('touchend', () => finishTouch(false), { passive: true });
  window.addEventListener('touchcancel', () => finishTouch(true), { passive: true });

  document.addEventListener('keydown', (event) => {
    if (!enabled() || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest('input, textarea, select, button, a, summary, [contenteditable], [role="tab"]')) return;
    const direction = event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey) ? 1 :
      event.key === 'PageUp' || (event.key === ' ' && event.shiftKey) ? -1 : 0;
    if (!direction) return;
    if (nestedScrollCanMove(event, direction)) return;
    event.preventDefault();
    if (!event.repeat) move(direction);
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('a[href^="#"]')) reset();
  });
  window.addEventListener('resize', reset, { passive: true });
  window.visualViewport?.addEventListener('resize', reset, { passive: true });
  desktop.addEventListener('change', reset);
  touch.addEventListener('change', reset);
  reducedMotion.addEventListener('change', reset);
})();
