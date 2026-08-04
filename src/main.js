import './style.css';
import { paintIcons } from './lib/ui.js';
import { renderWelcome } from './views/welcome.js';
import { renderMerge } from './views/merge.js';
import { renderSplit } from './views/split.js';

const app = document.querySelector('#app');

const routes = {
  '#/merge': renderMerge,
  '#/split': renderSplit,
};

function route() {
  const render = routes[window.location.hash] ?? renderWelcome;

  app.replaceChildren(render());
  paintIcons(document.body);
  window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', route);
route();
