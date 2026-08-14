import { marked } from 'marked';

/**
 * Markdown → PDF.
 *
 * The PDF itself is produced by the browser's own print engine: the rendered
 * markdown is written into a hidden iframe and printed, so headings, tables,
 * links and images all come out as real vector text the reader can select and
 * search — something a canvas-to-image converter cannot give.
 *
 * The stylesheet below is the single source of truth for how a document looks.
 * The on-screen preview injects the same string, so the preview *is* the proof.
 */

marked.use({ gfm: true, breaks: false });

/** Fonts the printed document asks for. Skipped if the network is unavailable. */
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap';

export const documentCss = `
  .markdown-body {
    font-family: 'Roboto', -apple-system, 'Segoe UI', system-ui, sans-serif;
    color: #2a2a2a;
    font-size: 15px;
    line-height: 1.75;
    word-wrap: break-word;
  }
  .markdown-body > *:first-child { margin-top: 0; }
  .markdown-body h1, .markdown-body h2, .markdown-body h3,
  .markdown-body h4, .markdown-body h5, .markdown-body h6 {
    margin: 1.8em 0 0.6em;
    font-weight: 700;
    line-height: 1.3;
    color: #2a2a2a;
    page-break-after: avoid;
    break-after: avoid;
  }
  .markdown-body h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #eaeaea; }
  .markdown-body h2 { font-size: 1.5em; padding-bottom: 0.25em; border-bottom: 1px solid #eaeaea; }
  .markdown-body h3 { font-size: 1.25em; }
  .markdown-body h4 { font-size: 1.05em; }
  .markdown-body h5, .markdown-body h6 { font-size: 1em; color: #6b6b6b; }
  .markdown-body p, .markdown-body ul, .markdown-body ol,
  .markdown-body blockquote, .markdown-body pre, .markdown-body table { margin: 0 0 1em; }
  .markdown-body ul, .markdown-body ol { padding-left: 1.6em; }
  .markdown-body ul { list-style: disc; }
  .markdown-body ol { list-style: decimal; }
  .markdown-body li { margin: 0.25em 0; }
  .markdown-body li > ul, .markdown-body li > ol { margin: 0.25em 0; }
  .markdown-body a { color: #4b8ef1; text-decoration: underline; }
  .markdown-body strong { font-weight: 700; }
  .markdown-body em { font-style: italic; }
  .markdown-body del { text-decoration: line-through; }
  .markdown-body blockquote {
    padding: 0.2em 1em;
    border-left: 4px solid #4b8ef1;
    color: #6b6b6b;
    background: #f7f7f7;
  }
  .markdown-body code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
    font-size: 0.88em;
    background: #f2f4f8;
    padding: 0.15em 0.4em;
    border-radius: 5px;
  }
  .markdown-body pre {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
    background: #f7f8fa;
    border: 1px solid #eaeaea;
    border-radius: 8px;
    padding: 14px 16px;
    white-space: pre-wrap;
    word-break: break-word;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .markdown-body pre code { background: none; padding: 0; font-size: 0.85em; line-height: 1.6; }
  .markdown-body table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.94em;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .markdown-body th, .markdown-body td {
    border: 1px solid #eaeaea;
    padding: 7px 11px;
    text-align: left;
    vertical-align: top;
  }
  .markdown-body th { background: #f7f7f7; font-weight: 700; }
  .markdown-body tr:nth-child(even) td { background: #fbfbfb; }
  .markdown-body img { max-width: 100%; height: auto; border-radius: 6px; }
  .markdown-body hr { border: 0; border-top: 1px solid #eaeaea; margin: 2em 0; }
  .markdown-body input[type="checkbox"] { margin-right: 0.4em; }
  .markdown-body li.task-list-item { list-style: none; margin-left: -1.2em; }
`;

/* ------------------------------------------------------------------ safety */

/**
 * The two rules the sanitiser enforces are pure functions so they can be
 * checked outside a browser — see markdown.selfcheck.mjs.
 */
export function isBannedTag(tag) {
  return BANNED_TAGS.has(tag.toLowerCase());
}

export function isSafeAttribute(name, value) {
  const lower = name.toLowerCase();
  if (lower.startsWith('on')) return false;
  if ((lower === 'href' || lower === 'src') && /^\s*javascript:/i.test(value)) return false;
  return true;
}

const BANNED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'link',
  'meta',
  'base',
  'svg',
]);

/**
 * marked deliberately passes raw HTML through, and markdown is frequently
 * pasted in from somewhere else — so anything that could execute is removed
 * before the string ever reaches the preview or the print frame.
 */
function sanitize(dirtyHtml) {
  const doc = new DOMParser().parseFromString(dirtyHtml, 'text/html');

  doc.body.querySelectorAll('*').forEach((element) => {
    const tag = element.tagName.toLowerCase();

    // Task-list checkboxes are the one input worth keeping — and only disabled.
    if (tag === 'input' && element.getAttribute('type') === 'checkbox') {
      [...element.attributes].forEach((attribute) => {
        if (!['type', 'checked', 'disabled'].includes(attribute.name)) {
          element.removeAttribute(attribute.name);
        }
      });
      element.setAttribute('disabled', '');
      return;
    }

    if (isBannedTag(tag)) {
      element.remove();
      return;
    }

    [...element.attributes].forEach(({ name, value }) => {
      if (!isSafeAttribute(name, value)) element.removeAttribute(name);
    });
  });

  return doc.body.innerHTML;
}

/** Markdown source → safe HTML string. */
export function renderMarkdown(source) {
  return sanitize(marked.parse(source ?? ''));
}

/** First `# heading` (or first non-empty line) — used as the document title. */
export function guessTitle(source) {
  const heading = source.match(/^\s{0,3}#{1,6}\s+(.+)$/m);
  const line = heading?.[1] ?? source.split('\n').find((row) => row.trim());
  return (line ?? '').replace(/[*_`~#>[\]()]/g, '').trim().slice(0, 90);
}

/* ------------------------------------------------------------------- print */

/** Waits for images and fonts so nothing prints half-drawn. */
async function waitForAssets(doc, timeoutMs = 8000) {
  const images = [...doc.images].map((image) =>
    image.complete
      ? Promise.resolve()
      : new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        }),
  );

  await Promise.race([
    Promise.all([...images, doc.fonts?.ready ?? Promise.resolve()]),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Opens the browser's print dialog on the rendered markdown.
 *
 * The document title becomes the suggested file name in the "Save as PDF"
 * dialog, which is why it is set rather than left to the iframe default.
 */
export async function printMarkdown(bodyHtml, { title, pageSize = 'A4', margin = '20mm' } = {}) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('title', 'Dokumen untuk dicetak');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <link rel="stylesheet" href="${FONT_HREF}" />
    <style>
      @page { size: ${pageSize}; margin: ${margin}; }
      html, body { margin: 0; padding: 0; background: #fff; }
      @media screen { body { padding: 24px; } }
      ${documentCss}
    </style>
  </head>
  <body class="markdown-body">${bodyHtml}</body>
</html>`);
  doc.close();

  await waitForAssets(doc);

  const cleanUp = () => setTimeout(() => frame.remove(), 500);
  frame.contentWindow.addEventListener('afterprint', cleanUp, { once: true });

  frame.contentWindow.focus();
  frame.contentWindow.print();

  // Safari never fires `afterprint` from a hidden frame; drop it either way.
  setTimeout(cleanUp, 60000);
}
