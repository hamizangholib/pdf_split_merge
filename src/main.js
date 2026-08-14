import './style.css';
import { paintIcons } from './lib/ui.js';
import { revealOnScroll } from './lib/reveal.js';
import { renderWelcome } from './views/welcome.js';

const app = document.querySelector('#app');

/**
 * Tools are imported on demand: pdf-lib and pdf.js together weigh more than the
 * rest of the app, and a visitor who only reads the landing page never needs
 * them. The landing view stays in the main bundle so the first paint is instant.
 */
const routes = {
  '#/merge': () => import('./views/merge.js').then((module) => module.renderMerge),
  '#/split': () => import('./views/split.js').then((module) => module.renderSplit),
  '#/organize': () => import('./views/organize.js').then((module) => module.renderOrganize),
  '#/images': () => import('./views/images.js').then((module) => module.renderImages),
  '#/markdown': () => import('./views/markdown.js').then((module) => module.renderMarkdownView),
  '#/compress': () => import('./views/compress.js').then((module) => module.renderCompress),
};

// Guards against a slow chunk landing after the visitor has moved on again.
let currentRoute = 0;

async function route() {
  const token = ++currentRoute;
  const load = routes[window.location.hash];

  let render = renderWelcome;
  if (load) {
    try {
      render = await load();
    } catch {
      // A failed chunk (offline, cache miss) must not leave a blank page.
      window.location.hash = '';
      return;
    }
  }

  if (token !== currentRoute) return;

  const view = render();
  view.classList.add('page-enter');
  app.replaceChildren(view);
  paintIcons(document.body);
  revealOnScroll(app);
  window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', route);
route();

// The header gains depth once the page leaves the top. Height stays fixed —
// the tool sub-navigation sticks directly beneath it.
const header = document.querySelector('.site-header');
if (header) {
  const syncHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  window.addEventListener('scroll', syncHeader, { passive: true });
  syncHeader();
}

/* ------------------------------------------------------------ mobile menu */

const menuToggle = document.querySelector('#menu-toggle');
const mobileMenu = document.querySelector('#mobile-menu');

if (menuToggle && mobileMenu) {
  const setMenu = (open) => {
    menuToggle.setAttribute('aria-expanded', String(open));
    mobileMenu.classList.toggle('is-open', open);
  };

  menuToggle.addEventListener('click', () =>
    setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'),
  );

  // Choosing a tool, pressing Escape, or clicking away all close it.
  mobileMenu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#mobile-menu, #menu-toggle')) setMenu(false);
  });
}

// The preloader has done its job the moment the first view is on screen.
const preloader = document.querySelector('#preloader');
if (preloader) {
  preloader.classList.add('is-done');
  preloader.addEventListener('transitionend', () => preloader.remove(), { once: true });
  // A background tab never runs the transition, so the overlay would otherwise
  // sit on top of the app for as long as the tab stays hidden.
  setTimeout(() => preloader.remove(), 1500);
}
