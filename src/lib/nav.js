import { cls } from './ui.js';
import { routes, routeBySlug, tools } from './routes.js';

export { routes, routeBySlug, tools };

/** Where the site is mounted — "/" in dev, "/pdf_split_merge/" on Pages. */
export const base = import.meta.env.BASE_URL;

/** The URL for a route slug. Trailing slash included: it is the directory the
 *  build writes each pre-rendered page into, so linking to it skips a redirect. */
export const pathOf = (slug) => `${base}${slug ? `${slug}/` : ''}`;

/** The slug a browser path points at, with the mount point and slashes removed. */
export function slugOf(pathname) {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  return rest.replace(/^\/+|\/+$/g, '');
}

/** The frosted sub-navigation every tool page carries. */
export function subNavMarkup(currentSlug) {
  const current = routeBySlug(currentSlug);
  const others = tools
    .filter((tool) => tool.slug !== currentSlug)
    .map(
      (tool) =>
        `<a href="${pathOf(tool.slug)}" class="shrink-0 text-caption ${cls.link}">${tool.label}</a>`,
    )
    .join('');

  return `
    <div class="sticky top-20 z-40 border-b border-hairline bg-white/85 backdrop-blur-xl backdrop-saturate-150">
      <div class="mx-auto flex h-[56px] max-w-[1200px] items-center gap-4 overflow-x-auto px-5">
        <a href="${pathOf('')}" class="flex shrink-0 items-center gap-1.5 text-caption ${cls.link}">
          <i data-lucide="arrow-left" class="size-4"></i>
          Beranda
        </a>
        <span class="shrink-0 text-tagline text-ink">${current?.label ?? ''}</span>
        <span class="ml-auto flex shrink-0 items-center gap-4">${others}</span>
      </div>
    </div>
  `;
}
