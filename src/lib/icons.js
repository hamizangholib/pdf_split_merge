/**
 * The brand icon set, drawn for this product rather than borrowed from an icon
 * library. Each entry holds only the inner shapes — `brandIcon()` supplies the
 * shared <svg> shell so stroke weight and geometry can never drift apart.
 *
 * All of them are stroke-only on `currentColor`, which is what lets the same
 * markup render blue on the light tiles and bright blue on the near-black ones.
 */
const shapes = {
  /** Two sheets flowing down into one. */
  merge: `
    <rect x="2.6" y="2.6" width="8" height="8" rx="1.8"/>
    <rect x="13.4" y="2.6" width="8" height="8" rx="1.8"/>
    <rect x="8" y="15.4" width="8" height="6" rx="1.8"/>
    <path d="M6.6 10.6c0 2.8 1.6 3.6 3.4 4.8"/>
    <path d="M17.4 10.6c0 2.8-1.6 3.6-3.4 4.8"/>
  `,
  /** A page lifted away from the stack it came from. */
  split: `
    <rect x="2.6" y="4.6" width="8.4" height="14.8" rx="1.8"/>
    <rect x="14" y="4.8" width="6.6" height="12.4" rx="1.8" transform="rotate(14 17.3 11)"/>
  `,
  /** Three pages at staggered heights — mid-rearrangement. */
  organize: `
    <rect x="2.6" y="7.4" width="5.2" height="11" rx="1.6"/>
    <rect x="9.4" y="4.8" width="5.2" height="11" rx="1.6"/>
    <rect x="16.2" y="7.4" width="5.2" height="11" rx="1.6"/>
  `,
  /** A photo sitting on a page. */
  images: `
    <rect x="4.6" y="2.6" width="14.8" height="18.8" rx="1.8"/>
    <rect x="7.6" y="6.4" width="8.8" height="6.8" rx="1.4"/>
    <path d="M8.4 12.6 11 10l3 2.8"/>
    <path d="M8 17.4h8"/>
    <path d="M8 19.6h4.6"/>
  `,
  /** A page squeezed from both sides. */
  compress: `
    <rect x="4.6" y="8" width="14.8" height="8" rx="1.8"/>
    <path d="M12 2.4v3.4"/>
    <path d="M9.7 3.6 12 5.9l2.3-2.3"/>
    <path d="M12 21.6v-3.4"/>
    <path d="M14.3 20.4 12 18.1l-2.3 2.3"/>
  `,
  /** The house mark: a sheet beside a page turning away from it. */
  brand: `
    <rect x="3.6" y="4.6" width="7" height="14.8" rx="1.8"/>
    <path d="M13.4 5.2 20.4 7.4v9.2l-7 2.2Z"/>
  `,
};

/** Wraps one of the shapes in the shared stroke shell at the requested size. */
export function brandIcon(name, className = 'size-6') {
  return `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="${className}"
      aria-hidden="true"
    >${shapes[name] ?? ''}</svg>
  `;
}
