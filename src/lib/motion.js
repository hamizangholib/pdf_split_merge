/**
 * Motion that carries information: a page moving, a page leaving, a result
 * arriving.
 *
 * Like the decorative animation in `style.css`, this deliberately ignores
 * `prefers-reduced-motion` — by request, the animations run on every device
 * regardless of the OS setting. Turn them back over to the setting by making
 * `prefersReduced` read the media query again:
 *
 *   const prefersReduced = () =>
 *     window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
 *
 * Everything uses the Web Animations API rather than CSS transitions and
 * inline styles: the browser owns the timing, and there is nothing to clean up
 * afterwards.
 */

const prefersReduced = () => false;

/**
 * Plays one animation and resolves when it is over.
 *
 * A hidden tab does not advance the document timeline, so `finished` can wait
 * forever; the timer guarantees a caller awaiting this never stalls with the
 * work half done.
 */
export function play(element, keyframes, options) {
  if (prefersReduced() || !element?.animate) return Promise.resolve();

  const animation = element.animate(keyframes, options);
  return Promise.race([
    animation.finished.catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, (options.duration ?? 0) + 120)),
  ]);
}

/* --------------------------------------------------------------------- FLIP */

/**
 * Where every `[data-key]` element in `container` is right now.
 *
 * Call this before a re-render, then `playFlip` after it: the grid still gets
 * rebuilt from scratch, but each card slides from where it used to be instead
 * of teleporting, so a reordering can actually be followed by eye.
 */
export function captureRects(container) {
  const rects = new Map();
  for (const element of container.querySelectorAll('[data-key]')) {
    rects.set(element.dataset.key, element.getBoundingClientRect());
  }
  return rects;
}

/**
 * Moves every `[data-key]` element from where `rects` says it was.
 *
 * A key that is not in `rects` belongs to a card that has just arrived — a file
 * added to the list, a page brought back by undo — so it fades in rather than
 * appearing mid-frame. The very first render has no rects at all and is left
 * alone: the whole list is showing up at once, and animating each row of it
 * would only look busy.
 */
export function playFlip(container, rects, duration = 220) {
  if (prefersReduced() || rects.size === 0) return;

  for (const element of container.querySelectorAll('[data-key]')) {
    const before = rects.get(element.dataset.key);
    if (!before) {
      enterIn(element);
      continue;
    }

    const after = element.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    // A card that did not move needs no animation — most of them, most of the time.
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

    element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
      duration,
      easing: 'cubic-bezier(0.2, 0, 0.2, 1)',
    });
  }
}

/* ------------------------------------------------------------- named moves */

/** A card arriving in a list that is already on screen. */
export const enterIn = (element) =>
  play(
    element,
    [
      { opacity: 0, transform: 'translateY(8px) scale(0.97)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 220, easing: 'cubic-bezier(0.2, 0, 0.2, 1)' },
  );

/**
 * A thumbnail replacing its spinner. Rasterising a page takes a moment and each
 * one finishes on its own, so without this a long document fills in as a burst
 * of little flashes.
 */
export const fadeIn = (element) =>
  play(element, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });

/**
 * Turning a page a quarter turn, the short way round.
 *
 * Going from 270° to 0° is forwards by 90°, not backwards by 270°, and undoing
 * a turn should visibly run the other way — so the delta is wrapped into
 * ±180° and the element is left sitting on `to`.
 */
export function rotateTo(element, from, to) {
  element.style.transform = `rotate(${to}deg)`;

  let delta = (((to - from) % 360) + 360) % 360;
  if (delta > 180) delta -= 360;
  if (delta === 0) return Promise.resolve();

  return play(
    element,
    [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${from + delta}deg)` }],
    { duration: 240, easing: 'cubic-bezier(0.2, 0, 0.2, 1)' },
  );
}

/** A card being deleted shrinks away, so it is clear which one just went. */
export const collapseOut = (element) =>
  play(
    element,
    [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.86)' },
    ],
    { duration: 150, easing: 'ease-in', fill: 'forwards' },
  );

/** The upload card hands over to the finished result rather than blinking out. */
export const fadeOut = (element) =>
  play(element, [{ opacity: 1 }, { opacity: 0 }], {
    duration: 180,
    easing: 'ease-out',
    fill: 'forwards',
  });

/** A short pop marking something that has just entered the selection. */
export const pop = (element) =>
  play(
    element,
    [{ transform: 'scale(1)' }, { transform: 'scale(1.045)' }, { transform: 'scale(1)' }],
    { duration: 260, easing: 'ease-out' },
  );

/** A status banner rising into place as it changes state. */
export const riseIn = (element) =>
  play(element, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], {
    duration: 200,
    easing: 'ease-out',
  });
