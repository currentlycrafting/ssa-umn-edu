/* SSA motion system — Anime.js v4 (ESM via CDN, graceful fallback).
   Declarative hooks:
     [data-reveal]        fade/slide in when scrolled into view
     [data-reveal-group]  stagger-reveal direct children
     [data-draw]          SVG line-drawing on view (paths/lines/circles inside)
   Programmatic API on window.ssaMotion: animate, createTimeline, stagger,
   svg, utils, ready(fn). */
(async function () {
  let A = null;
  try {
    A = await import('https://cdn.jsdelivr.net/npm/animejs@4.2.2/+esm');
  } catch (error) {
    A = null;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enabled = A && !reduced;
  const readyFns = [];

  window.ssaMotion = {
    enabled,
    animate: enabled ? A.animate : () => ({}),
    createTimeline: enabled ? A.createTimeline : () => ({ add: () => ({}) }),
    stagger: enabled ? A.stagger : () => 0,
    svg: enabled ? A.svg : null,
    utils: enabled ? A.utils : null,
    ready(fn) {
      readyFns.push(fn);
      fn(window.ssaMotion);
    }
  };

  function showAll() {
    document.querySelectorAll('[data-reveal], [data-reveal-group] > *').forEach((el) => {
      el.style.opacity = '';
      el.style.transform = '';
    });
  }

  if (!enabled) {
    showAll();
    document.dispatchEvent(new CustomEvent('ssa:motion-ready'));
    return;
  }

  const { animate, stagger, svg } = A;

  // Hide reveal targets before first paint of animation
  const revealTargets = [];
  document.querySelectorAll('[data-reveal]').forEach((el) => revealTargets.push([el, [el]]));
  document.querySelectorAll('[data-reveal-group]').forEach((el) => {
    revealTargets.push([el, Array.from(el.children)]);
  });
  revealTargets.forEach(([, children]) => {
    children.forEach((c) => { c.style.opacity = '0'; });
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      const found = revealTargets.find(([el]) => el === entry.target);
      if (!found) return;
      animate(found[1], {
        opacity: [0, 1],
        translateY: [24, 0],
        duration: 700,
        delay: stagger(90),
        ease: 'cubicBezier(.22,.8,.26,1)'
      });
    });
  }, { threshold: 0.12 });
  revealTargets.forEach(([el]) => io.observe(el));

  // SVG line drawing
  const drawIo = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      drawIo.unobserve(entry.target);
      const shapes = entry.target.querySelectorAll('path, line, polyline, circle, rect, ellipse');
      if (!shapes.length) return;
      try {
        animate(svg.createDrawable(shapes), {
          draw: ['0 0', '0 1'],
          duration: 1500,
          delay: stagger(160),
          ease: 'inOutSine'
        });
      } catch (error) { /* non-drawable shapes */ }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('[data-draw]').forEach((el) => drawIo.observe(el));

  document.dispatchEvent(new CustomEvent('ssa:motion-ready'));
})();
