import './style.css';
import { paintIcons } from './lib/ui.js';
import { revealOnScroll } from './lib/reveal.js';
import { renderWelcome } from './views/welcome.js';
import { base, pathOf, routeBySlug, slugOf } from './lib/nav.js';
import { legacyHashes, site } from './lib/routes.js';

const app = document.querySelector('#app');

/**
 * Tools are imported on demand: pdf-lib and pdf.js together weigh more than the
 * rest of the app, and a visitor who only reads the landing page never needs
 * them. The landing view stays in the main bundle so the first paint is instant.
 */
const views = {
  merge: () => import('./views/merge.js').then((module) => module.renderMerge),
  split: () => import('./views/split.js').then((module) => module.renderSplit),
  organize: () => import('./views/organize.js').then((module) => module.renderOrganize),
  images: () => import('./views/images.js').then((module) => module.renderImages),
  markdown: () => import('./views/markdown.js').then((module) => module.renderMarkdownView),
  compress: () => import('./views/compress.js').then((module) => module.renderCompress),
};

/* ------------------------------------------------------------- head fields */

/**
 * Every route is its own URL now, so every route needs its own title,
 * description, and canonical — a search engine that only ever sees the home
 * page's metadata will only ever rank the home page.
 */
function setMeta(route) {
  const url = `${site}${route.slug ? `/${route.slug}/` : '/'}`;

  document.title = route.title;
  document.documentElement.lang = 'id';

  const set = (selector, attribute, value) =>
    document.head.querySelector(selector)?.setAttribute(attribute, value);

  set('link[rel="canonical"]', 'href', url);
  set('meta[name="description"]', 'content', route.description);
  set('meta[property="og:title"]', 'content', route.title);
  set('meta[property="og:description"]', 'content', route.description);
  set('meta[property="og:url"]', 'content', url);
  set('meta[name="twitter:title"]', 'content', route.title);
  set('meta[name="twitter:description"]', 'content', route.description);
}

/* ----------------------------------------------------------------- routing */

// Guards against a slow chunk landing after the visitor has moved on again.
let currentRoute = 0;

const announcer = document.querySelector('#route-announcer');

async function route() {
  const token = ++currentRoute;
  const slug = slugOf(window.location.pathname);
  const match = routeBySlug(slug);

  // An unknown path is not a route; show the landing page under its own URL
  // rather than an empty shell.
  if (!match) {
    window.history.replaceState(null, '', pathOf(''));
    return route();
  }

  let render = renderWelcome;
  if (match.key !== 'home') {
    try {
      render = await views[match.key]();
    } catch {
      // A failed chunk (offline, cache miss) must not leave a blank page.
      window.history.replaceState(null, '', pathOf(''));
      return route();
    }
  }

  if (token !== currentRoute) return;

  setMeta(match);

  const view = render();
  view.classList.add('page-enter');
  app.replaceChildren(view);
  // Only the new view can hold unpainted icons — the header and footer were
  // painted once at boot and never change.
  paintIcons(app);
  revealOnScroll(app);
  window.scrollTo({ top: 0 });

  // A single-page navigation changes nothing a screen reader notices on its
  // own: no page load, no focus move. Both are done by hand here.
  announcer.textContent = `${match.label} — halaman dimuat`;
  const heading = view.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

/** Navigates without a page load, leaving a real entry in the back button. */
function navigate(path) {
  if (path === window.location.pathname) return;
  window.history.pushState(null, '', path);
  route();
}

// Internal links are ordinary <a href> elements, so they keep working when the
// script fails: this only upgrades them to an in-place render.
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const anchor = event.target.closest('a[href]');
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return;
  if (!url.pathname.startsWith(base)) return;
  // In-page anchors (the skip link) must keep their default behaviour.
  if (url.pathname === window.location.pathname && url.hash) return;

  event.preventDefault();
  navigate(url.pathname);
});

// The shell's own icons — header, footer — are painted once here.
paintIcons(document.body);

window.addEventListener('popstate', route);

// Links shared before the site moved to real paths still arrive as "#/merge".
const legacy = legacyHashes[window.location.hash];
if (legacy !== undefined) {
  window.history.replaceState(null, '', pathOf(legacy));
}

route();

/* ------------------------------------------------------------------ header */

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
