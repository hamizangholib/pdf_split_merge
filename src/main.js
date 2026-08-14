import './style.css';
import { paintIcons } from './lib/ui.js';
import { revealOnScroll } from './lib/reveal.js';
import { renderWelcome } from './views/welcome.js';
import { renderMerge } from './views/merge.js';
import { renderSplit } from './views/split.js';
import { renderOrganize } from './views/organize.js';
import { renderImages } from './views/images.js';
import { renderMarkdownView } from './views/markdown.js';
import { renderCompress } from './views/compress.js';

const app = document.querySelector('#app');

const routes = {
  '#/merge': renderMerge,
  '#/split': renderSplit,
  '#/organize': renderOrganize,
  '#/images': renderImages,
  '#/markdown': renderMarkdownView,
  '#/compress': renderCompress,
};

function route() {
  const render = routes[window.location.hash] ?? renderWelcome;
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

// The preloader has done its job the moment the first view is on screen.
const preloader = document.querySelector('#preloader');
if (preloader) {
  preloader.classList.add('is-done');
  preloader.addEventListener('transitionend', () => preloader.remove(), { once: true });
  // A background tab never runs the transition, so the overlay would otherwise
  // sit on top of the app for as long as the tab stays hidden.
  setTimeout(() => preloader.remove(), 1500);
}
