/**
 * Scroll reveal, as in the reference template — sections fade up as they come
 * into view. Each element is unobserved after its first reveal, so scrolling
 * back up never replays the animation.
 *
 * Anything already inside the viewport on load is revealed immediately, which
 * keeps the hero from animating in after the visitor is already looking at it.
 */
const observer =
  'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
      )
    : null;

/** Starts watching every `.reveal` inside `root`. */
export function revealOnScroll(root) {
  const targets = root.querySelectorAll('.reveal:not(.is-visible)');

  if (!observer) {
    targets.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  targets.forEach((element) => observer.observe(element));
}
