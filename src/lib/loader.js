import {
  attachDropzone,
  cls,
  dropzoneMarkup,
  errorText,
  formatBytes,
  html,
  paintIcons,
  progressMarkup,
  readFileBytes,
  setProgress,
  setVisible,
} from './ui.js';

/**
 * The "pick one file" flow every single-document tool needs: a dropzone, a
 * progress card while the file is read and parsed, and a failure state that
 * stays on screen with a way back.
 *
 * `onReady(file, bytes)` does the tool-specific parsing and may throw; its
 * message is shown on the card.
 */
export function createFileLoader({
  id,
  title = 'Tarik satu file PDF ke sini',
  hint = 'Atau klik untuk memilih file dari perangkat Anda.',
  accept = 'application/pdf,.pdf',
  onReady,
  onReset,
}) {
  const element = html(`
    <div class="space-y-8">
      <div data-upload>
        ${dropzoneMarkup({ id, multiple: false, title, hint, accept })}
      </div>

      <div
        data-loading
        class="space-y-4 rounded-lg border border-hairline bg-white px-5 py-4"
        style="display: none"
      >
        <div class="flex flex-wrap items-center gap-4">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-sm bg-parchment text-action">
            <i data-lucide="file-text" class="size-5"></i>
          </span>
          <span class="min-w-0 flex-1">
            <span data-loading-name class="block truncate text-body text-ink"></span>
            <span data-loading-size class="block text-fine text-ink-48"></span>
          </span>
          <button type="button" data-retry class="${cls.pillGhost}" style="display: none">
            Pilih file lain
          </button>
        </div>
        ${progressMarkup()}
        <p data-loading-error class="text-caption text-[#b3261e]" style="display: none"></p>
      </div>
    </div>
  `);

  const uploadHost = element.querySelector('[data-upload]');
  const loadingHost = element.querySelector('[data-loading]');
  const nameHost = element.querySelector('[data-loading-name]');
  const sizeHost = element.querySelector('[data-loading-size]');
  const errorHost = element.querySelector('[data-loading-error]');
  const progressHost = element.querySelector('[data-progress]');
  const retryButton = element.querySelector('[data-retry]');

  async function load(file) {
    // Show the card before any parsing starts, so a slow or broken file never
    // looks like nothing happened.
    setVisible(uploadHost, false);
    setVisible(loadingHost, true);
    setVisible(retryButton, false);
    setVisible(errorHost, false);
    nameHost.textContent = file.name;
    sizeHost.textContent = formatBytes(file.size);
    setProgress(progressHost, 'reading', 0);

    try {
      const bytes = await readFileBytes(file, (ratio) =>
        setProgress(progressHost, 'reading', ratio),
      );
      setProgress(progressHost, 'processing');
      await onReady(file, bytes);
      setProgress(progressHost, 'ready');
      setVisible(loadingHost, false);
    } catch (error) {
      onReset?.();
      setProgress(progressHost, 'error');
      errorHost.textContent = errorText(error);
      setVisible(errorHost, true);
      setVisible(retryButton, true);
    }
  }

  function reset() {
    onReset?.();
    setVisible(loadingHost, false);
    setVisible(uploadHost, true);
  }

  attachDropzone(
    element.querySelector(`#${id}-zone`),
    element.querySelector(`#${id}-input`),
    (files) => load(files[0]),
  );
  retryButton.addEventListener('click', reset);
  paintIcons(element);

  return { element, load, reset };
}
