const { PDFDocument, StandardFonts, degrees, rgb } = PDFLib;
const COVER_PAGE_SIZE = [595.28, 841.89];
const PAGE_SIZES = {
  a4: COVER_PAGE_SIZE,
  letter: [612, 792],
};
const TOC_ENTRIES_PER_PAGE = 24;

const els = {
  addButton: document.getElementById('add-btn'),
  blankAfterCount: document.getElementById('blank-after-count'),
  blankBeforeCount: document.getElementById('blank-before-count'),
  clearButton: document.getElementById('clear-btn'),
  coverOptions: document.getElementById('cover-options'),
  coverPage: document.getElementById('cover-page'),
  coverSubtitle: document.getElementById('cover-subtitle'),
  coverTitle: document.getElementById('cover-title'),
  dateStamp: document.getElementById('date-stamp'),
  dateStampOptions: document.getElementById('date-stamp-options'),
  dateStampPosition: document.getElementById('date-stamp-position'),
  dateStampText: document.getElementById('date-stamp-text'),
  dropzone: document.getElementById('dropzone'),
  dropHint: document.getElementById('drop-hint'),
  duplexBlanks: document.getElementById('duplex-blanks'),
  emptyState: document.getElementById('empty-state'),
  fileInput: document.getElementById('file-input'),
  fileList: document.getElementById('file-list'),
  flattenForms: document.getElementById('flatten-forms'),
  metadataAuthor: document.getElementById('metadata-author'),
  metadataSubject: document.getElementById('metadata-subject'),
  metadataTitle: document.getElementById('metadata-title'),
  output: document.getElementById('output'),
  outputName: document.getElementById('output-name'),
  layoutMargin: document.getElementById('layout-margin'),
  pageNumberFormat: document.getElementById('page-number-format'),
  pageNumberOptions: document.getElementById('page-number-options'),
  pageNumberPosition: document.getElementById('page-number-position'),
  pageNumberScope: document.getElementById('page-number-scope'),
  pageNumberStart: document.getElementById('page-number-start'),
  pageNumbers: document.getElementById('page-numbers'),
  pageSizeMode: document.getElementById('page-size-mode'),
  previewButton: document.getElementById('preview-btn'),
  previewFrame: document.getElementById('preview-frame'),
  previewPlaceholder: document.getElementById('preview-placeholder'),
  previewNote: document.getElementById('preview-note'),
  previewTitle: document.getElementById('preview-title'),
  queueNote: document.getElementById('queue-note'),
  separatorPages: document.getElementById('separator-pages'),
  sourceLabelOptions: document.getElementById('source-label-options'),
  sourceLabelPosition: document.getElementById('source-label-position'),
  sourceLabels: document.getElementById('source-labels'),
  status: document.getElementById('status'),
  summary: document.getElementById('summary'),
  tocOptions: document.getElementById('toc-options'),
  tocPage: document.getElementById('toc-page'),
  tocTitle: document.getElementById('toc-title'),
  toolMode: document.getElementById('tool-mode'),
  watermarkAngle: document.getElementById('watermark-angle'),
  watermarkOpacity: document.getElementById('watermark-opacity'),
  watermarkOpacityValue: document.getElementById('watermark-opacity-value'),
  watermarkSize: document.getElementById('watermark-size'),
  watermarkSizeValue: document.getElementById('watermark-size-value'),
  watermarkText: document.getElementById('watermark-text'),
};

const state = {
  items: [],
  nextId: 1,
  activeItemId: null,
  busy: false,
  notice: '',
  downloadUrl: null,
  outputSummary: '',
  outputName: '',
};

function isPdfFile(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function buildOutputName() {
  const requestedName = sanitizePdfName(els.outputName.value);
  if (requestedName) {
    return requestedName;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
  return `merged-${stamp}.pdf`;
}

function sanitizePdfName(value) {
  const name = value.trim().replace(/[\\/:*?"<>|]+/g, '-');
  if (!name || name === '.pdf') {
    return '';
  }
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
}

function cleanTextInput(value, maxLength = 160) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function toDrawableText(value, fallback = '') {
  const text = cleanTextInput(value).replace(/[^\x20-\x7E\xA0-\xFF]/g, '?').trim();
  return text || fallback;
}

function stripPdfExtension(value) {
  return value.replace(/\.pdf$/i, '');
}

function getToolMode() {
  return els.toolMode.value || 'combine';
}

function getCoverOptions() {
  const outputName = stripPdfExtension(buildOutputName());
  return {
    enabled: els.coverPage.checked,
    title: cleanTextInput(els.coverTitle.value) || outputName || 'Merged PDF',
    subtitle: cleanTextInput(els.coverSubtitle.value),
  };
}

function getTocOptions() {
  return {
    enabled: els.tocPage.checked,
    title: cleanTextInput(els.tocTitle.value) || 'Table of contents',
  };
}

function getLayoutOptions() {
  const sizeMode = els.pageSizeMode.value;
  const pageSize = PAGE_SIZES[sizeMode] || COVER_PAGE_SIZE;
  return {
    sizeMode,
    pageSize,
    margin: clampInteger(els.layoutMargin.value, 0, 72, 24),
    blankBefore: clampInteger(els.blankBeforeCount.value, 0, 20, 0),
    blankAfter: clampInteger(els.blankAfterCount.value, 0, 20, 0),
  };
}

function getMetadataOptions() {
  return {
    title: cleanTextInput(els.metadataTitle.value),
    author: cleanTextInput(els.metadataAuthor.value),
    subject: cleanTextInput(els.metadataSubject.value),
  };
}

function getSourceLabelOptions() {
  return {
    enabled: els.sourceLabels.checked,
    position: els.sourceLabelPosition.value || 'top-left',
  };
}

function getDateStampOptions() {
  return {
    enabled: els.dateStamp.checked,
    text: toDrawableText(els.dateStampText.value, new Date().toLocaleDateString()),
    position: els.dateStampPosition.value || 'top-right',
  };
}

function hasMetadataOptions() {
  const options = getMetadataOptions();
  return Boolean(options.title || options.author || options.subject);
}

function getWatermarkOptions() {
  const text = toDrawableText(els.watermarkText.value);
  const opacity = Math.max(0, Math.min(1, Number(els.watermarkOpacity.value) / 100));
  const size = Math.max(18, Math.min(96, Number(els.watermarkSize.value)));
  const angle = Number(els.watermarkAngle.value);
  return { text, opacity, size, angle: Number.isFinite(angle) ? angle : -35 };
}

function getPageNumberOptions() {
  return {
    format: els.pageNumberFormat.value,
    position: els.pageNumberPosition.value,
    scope: els.pageNumberScope.value,
    start: clampInteger(els.pageNumberStart.value, 1, 9999, 1),
  };
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function activeModifierLabels() {
  const labels = [];
  const toolMode = getToolMode();
  if (toolMode === 'extract') {
    labels.push('extracted pages');
  }
  if (toolMode === 'remove') {
    labels.push('removed pages');
  }
  if (toolMode === 'rotate') {
    labels.push('rotated pages');
  }
  if (toolMode === 'duplicate') {
    labels.push('duplicated pages');
  }
  const layoutOptions = getLayoutOptions();
  if (layoutOptions.sizeMode !== 'original') {
    labels.push(`${layoutOptions.sizeMode.toUpperCase()} page fit`);
  }
  if (layoutOptions.blankBefore || layoutOptions.blankAfter) {
    labels.push('blank pages');
  }
  if (toolMode === 'combine' && els.coverPage.checked) {
    labels.push('cover page');
  }
  if (toolMode === 'combine' && els.separatorPages.checked && state.items.length > 1) {
    labels.push('separator pages');
  }
  if (toolMode === 'combine' && els.tocPage.checked) {
    labels.push('table of contents');
  }
  if (toolMode === 'combine' && els.duplexBlanks.checked && state.items.length > 1) {
    labels.push('duplex blanks');
  }
  if (els.flattenForms.checked) {
    labels.push('flattened forms');
  }
  if (els.pageNumbers.checked) {
    labels.push('page numbers');
  }
  if (els.sourceLabels.checked) {
    labels.push('source labels');
  }
  if (els.dateStamp.checked) {
    labels.push('date stamp');
  }
  if (getWatermarkOptions().text) {
    labels.push('watermark');
  }
  if (state.items.some((item) => item.reverse)) {
    labels.push('reversed pages');
  }
  if (hasMetadataOptions()) {
    labels.push('metadata');
  }
  return labels;
}

function setNotice(message) {
  state.notice = message;
  render();
}

function clearOutput() {
  if (state.downloadUrl) {
    URL.revokeObjectURL(state.downloadUrl);
    state.downloadUrl = null;
  }
  state.outputSummary = '';
  state.outputName = '';
  els.output.textContent = 'No preview generated yet.';
  syncPreviewFrame();
}

function syncPreviewFrame() {
  const activeItem = getActiveItem();
  const previewUrl = state.downloadUrl || activeItem?.previewUrl || '';

  if (!previewUrl) {
    els.previewFrame.src = 'about:blank';
    els.previewFrame.hidden = true;
    els.previewPlaceholder.hidden = false;
    return;
  }

  els.previewPlaceholder.hidden = true;
  els.previewFrame.hidden = false;
  if (els.previewFrame.src !== previewUrl) {
    els.previewFrame.src = previewUrl;
  }
}

function getActiveItem() {
  if (!state.items.length) {
    return null;
  }
  return state.items.find((item) => item.id === state.activeItemId) || state.items[0];
}

function getActiveItemIndex() {
  const activeItem = getActiveItem();
  return activeItem ? state.items.findIndex((item) => item.id === activeItem.id) : -1;
}

function setActiveItem(id) {
  if (state.activeItemId === id) {
    return;
  }
  state.activeItemId = id;
  clearOutput();
  state.notice = '';
  render();
}

function revokeItemPreview(item) {
  if (item?.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
    item.previewUrl = '';
  }
}

function totalPages() {
  return state.items.reduce((sum, item) => sum + (typeof item.pages === 'number' ? item.pages : 0), 0);
}

function selectedPagesTotal() {
  const toolMode = getToolMode();
  return state.items.reduce((sum, item) => {
    if (typeof item.pages !== 'number' || item.error) {
      return sum;
    }

    const selection = resolvePageSelection(item.range, item.pages, toolMode);
    if (!selection.ok) {
      return sum;
    }
    return sum + selection.indices.length;
  }, 0);
}

function formatSelectionTotal(count, mode) {
  if (mode === 'remove' || mode === 'rotate' || mode === 'duplicate') {
    return pluralize(count, 'output page');
  }
  return pluralize(count, 'selected page');
}

function getTocPageCount() {
  return Math.max(1, Math.ceil(state.items.length / TOC_ENTRIES_PER_PAGE));
}

function buildAssemblyPlan(frontPageCount) {
  let pageCount = frontPageCount;
  const toolMode = getToolMode();
  const isCombine = toolMode === 'combine';

  return state.items.map((item, index) => {
    const selection = resolvePageSelection(item.range, item.pages, toolMode);
    const selectedCount = selection.ok ? selection.indices.length : 0;
    const blankBefore = isCombine && index > 0 && els.duplexBlanks.checked && pageCount % 2 === 1;

    if (blankBefore) {
      pageCount += 1;
    }

    const separatorPage = isCombine && index > 0 && els.separatorPages.checked ? pageCount + 1 : null;
    if (separatorPage) {
      pageCount += 1;
    }

    const startPage = pageCount + 1;
    pageCount += selectedCount;

    return {
      item,
      index,
      selectedCount,
      indices: selection.ok ? selection.indices : [],
      rotatedSet: selection.ok ? selection.rotatedSet : new Set(),
      duplicatedSet: selection.ok ? selection.duplicatedSet : new Set(),
      rotatedCount: selection.ok ? selection.rotatedCount : 0,
      duplicatedCount: selection.ok ? selection.duplicatedCount : 0,
      rangeLabel: item.range.trim() || getRangePlaceholder(toolMode, item.pages),
      blankBefore,
      separatorPage,
      startPage,
      sectionStartPage: separatorPage || startPage,
    };
  });
}

function hasErrors() {
  return state.items.some((item) => item.error);
}

function hasRangeErrors() {
  return state.items.some((item) => typeof item.pages === 'number' && !resolvePageSelection(item.range, item.pages, getToolMode()).ok);
}

function countPending() {
  return state.items.filter((item) => typeof item.pages !== 'number' && !item.error).length;
}

function renderSummary() {
  const count = state.items.length;
  if (!count) {
    els.summary.textContent = '0 files • 0 pages';
    return;
  }

  if (hasErrors()) {
    els.summary.textContent = `${pluralize(count, 'file')} • fix unreadable item`;
    return;
  }

  if (hasRangeErrors()) {
    els.summary.textContent = `${pluralize(count, 'file')} • fix page range`;
    return;
  }

  if (countPending()) {
    els.summary.textContent = `${pluralize(count, 'file')} • reading...`;
    return;
  }

  els.summary.textContent = `${pluralize(count, 'file')} • ${formatSelectionTotal(selectedPagesTotal(), getToolMode())}`;
}

function renderStatus() {
  const toolMode = getToolMode();
  if (state.busy) {
    els.status.textContent = `Creating ${getToolNoun(toolMode)} preview...`;
    return;
  }

  if (hasErrors()) {
    els.status.textContent = 'Remove or replace the unreadable file to continue.';
    return;
  }

  if (hasRangeErrors()) {
    els.status.textContent = 'Fix the highlighted page range before previewing.';
    return;
  }

  if (countPending()) {
    els.status.textContent = 'Reading file details...';
    return;
  }

  if (state.notice) {
    els.status.textContent = state.notice;
    return;
  }

  els.status.textContent = state.items.length ? `Ready to preview ${getToolNoun(toolMode)}.` : 'Ready.';
}

function renderOutput() {
  els.output.textContent = '';

  if (!state.downloadUrl) {
    els.output.textContent = 'No preview generated yet.';
    return;
  }

  const text = document.createElement('span');
  text.textContent = state.outputSummary || 'Merged file is ready.';

  const link = document.createElement('a');
  link.className = 'download-link';
  link.href = state.downloadUrl;
  link.download = state.outputName || 'merged.pdf';
  link.textContent = 'Download modified PDF';

  els.output.append(text, document.createElement('br'), link);
}

function renderPreview() {
  if (state.downloadUrl) {
    els.previewTitle.textContent = 'Modified Preview';
    syncPreviewFrame();
    els.previewNote.textContent = state.outputSummary || 'Preview is ready for inspection.';
    return;
  }

  const activeItem = getActiveItem();
  els.previewTitle.textContent = 'Document View';

  if (!activeItem) {
    syncPreviewFrame();
    els.previewPlaceholder.textContent = 'Selected PDF will appear here.';
    els.previewNote.textContent = 'Select a PDF to view it here before applying tools.';
    return;
  }

  syncPreviewFrame();
  const activeIndex = getActiveItemIndex();
  const pageText = typeof activeItem.pages === 'number' ? ` • ${pluralize(activeItem.pages, 'page')}` : '';
  els.previewNote.textContent = `Viewing ${activeItem.name}${pageText} • document ${activeIndex + 1} of ${state.items.length}.`;
}

function renderQueueNote() {
  const toolMode = getToolMode();
  if (!state.items.length) {
    els.queueNote.textContent = getEmptyQueueText(toolMode);
    els.dropHint.textContent = 'No files selected.';
    return;
  }

  const pages = countPending() ? 'reading details' : `${formatSelectionTotal(selectedPagesTotal(), toolMode)} from ${pluralize(totalPages(), 'source page')}`;
  els.queueNote.textContent = `${pluralize(state.items.length, 'file')} queued • ${pages} • ${getToolActionLabel(toolMode)}`;
  els.dropHint.textContent = `${pluralize(state.items.length, 'file')} queued.`;
}

function getToolNoun(mode) {
  if (mode === 'extract') {
    return 'extraction';
  }
  if (mode === 'remove') {
    return 'page removal';
  }
  if (mode === 'rotate') {
    return 'rotation';
  }
  if (mode === 'duplicate') {
    return 'duplication';
  }
  return 'combination';
}

function getToolActionLabel(mode) {
  if (mode === 'extract') {
    return 'extract selected pages';
  }
  if (mode === 'remove') {
    return 'remove selected pages';
  }
  if (mode === 'rotate') {
    return 'rotate selected pages';
  }
  if (mode === 'duplicate') {
    return 'duplicate selected pages';
  }
  return 'combine and modify';
}

function getOutputVerb(mode) {
  if (mode === 'extract') {
    return 'extracted';
  }
  if (mode === 'remove') {
    return 'filtered';
  }
  if (mode === 'rotate') {
    return 'rotated';
  }
  if (mode === 'duplicate') {
    return 'duplicated';
  }
  return 'modified';
}

function getEmptyQueueText(mode) {
  if (mode === 'extract') {
    return 'Add PDF files and choose the pages to extract.';
  }
  if (mode === 'remove') {
    return 'Add PDF files and choose the pages to remove.';
  }
  if (mode === 'rotate') {
    return 'Add PDF files, choose pages, and set the rotation.';
  }
  if (mode === 'duplicate') {
    return 'Add PDF files and choose pages to duplicate.';
  }
  return 'Add PDF files, choose pages, and adjust rotation.';
}

function renderList() {
  els.fileList.innerHTML = '';
  els.emptyState.hidden = state.items.length > 0;

  state.items.forEach((item, index) => {
    const isActive = item.id === getActiveItem()?.id;
    const li = document.createElement('li');
    li.className = `file-item${isActive ? ' is-active' : ''}`;

    const main = document.createElement('div');
    main.className = 'file-main';

    const indexBadge = document.createElement('span');
    indexBadge.className = 'file-index';
    indexBadge.textContent = String(index + 1);

    const textWrap = document.createElement('div');
    textWrap.className = 'file-text';

    const title = document.createElement('p');
    title.className = 'file-title';
    title.title = item.name;
    title.textContent = item.name;

    const meta = document.createElement('div');
    meta.className = 'file-meta';

    const size = document.createElement('span');
    size.textContent = formatBytes(item.file.size);
    meta.append(size);

    const pages = document.createElement('span');
    if (item.error) {
      pages.className = 'file-error';
      pages.textContent = item.error;
    } else if (typeof item.pages === 'number') {
      pages.textContent = pluralize(item.pages, 'page');
    } else {
      pages.textContent = 'Reading...';
    }
    meta.append(pages);

    textWrap.append(title, meta);

    if (typeof item.pages === 'number' && !item.error) {
      textWrap.append(buildFileOptions(item));
    }

    main.append(indexBadge, textWrap);

    const actions = document.createElement('div');
    actions.className = 'file-actions';

    const view = document.createElement('button');
    view.type = 'button';
    view.className = 'small-btn';
    view.textContent = isActive ? 'Viewing' : 'View';
    view.setAttribute('aria-label', `View ${item.name}`);
    view.disabled = state.busy || isActive;
    view.addEventListener('click', () => setActiveItem(item.id));

    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'icon-btn';
    up.textContent = '↑';
    up.setAttribute('aria-label', `Move ${item.name} up`);
    up.disabled = state.busy || index === 0;
    up.addEventListener('click', () => moveItem(item.id, -1));

    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'icon-btn';
    down.textContent = '↓';
    down.setAttribute('aria-label', `Move ${item.name} down`);
    down.disabled = state.busy || index === state.items.length - 1;
    down.addEventListener('click', () => moveItem(item.id, 1));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon-btn';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${item.name}`);
    remove.disabled = state.busy;
    remove.addEventListener('click', () => removeItem(item.id));

    actions.append(view, up, down, remove);
    li.append(main, actions);
    els.fileList.append(li);
  });
}

function buildFileOptions(item) {
  const toolMode = getToolMode();
  const options = document.createElement('div');
  options.className = 'file-options';

  const selection = resolvePageSelection(item.range, item.pages, toolMode);

  const rangeField = document.createElement('label');
  rangeField.className = 'range-field';

  const rangeLabel = document.createElement('span');
  rangeLabel.textContent = getRangeLabel(toolMode);

  const rangeInput = document.createElement('input');
  rangeInput.type = 'text';
  rangeInput.value = item.range;
  rangeInput.placeholder = getRangePlaceholder(toolMode, item.pages);
  rangeInput.inputMode = 'text';
  rangeInput.setAttribute('aria-label', `Page range for ${item.name}`);
  if (!selection.ok) {
    rangeInput.classList.add('is-invalid');
  }
  rangeInput.addEventListener('input', (event) => {
    item.range = event.target.value;
    clearOutput();
    state.notice = '';
  });
  rangeInput.addEventListener('change', render);

  rangeField.append(rangeLabel, rangeInput);

  const helper = document.createElement('div');
  helper.className = selection.ok ? 'field-help' : 'field-help field-error';
  helper.textContent = selection.ok ? getRangeHelperText(selection, toolMode) : selection.error;

  const rotateGroup = document.createElement('div');
  rotateGroup.className = 'rotate-group';
  rotateGroup.setAttribute('aria-label', `Rotation for ${item.name}`);

  const rotateLabel = document.createElement('span');
  rotateLabel.textContent = toolMode === 'rotate' ? 'Rotate selected' : 'Rotate';

  const rotateButtons = document.createElement('div');
  rotateButtons.className = 'segmented';

  [0, 90, 180, 270].forEach((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = value === 0 ? '0' : `${value}`;
    button.className = item.rotation === value ? 'is-selected' : '';
    button.setAttribute('aria-label', `Rotate ${item.name} ${value} degrees`);
    button.disabled = state.busy;
    button.addEventListener('click', () => updateRotation(item.id, value));
    rotateButtons.append(button);
  });

  rotateGroup.append(rotateLabel, rotateButtons);

  const reverseField = document.createElement('label');
  reverseField.className = 'mini-check';

  const reverseInput = document.createElement('input');
  reverseInput.type = 'checkbox';
  reverseInput.checked = item.reverse;
  reverseInput.disabled = state.busy;
  reverseInput.setAttribute('aria-label', `Reverse selected pages for ${item.name}`);
  reverseInput.addEventListener('change', (event) => updateReverse(item.id, event.target.checked));

  const reverseLabel = document.createElement('span');
  reverseLabel.textContent = toolMode === 'combine' || toolMode === 'extract'
    ? 'Reverse selected page order'
    : 'Reverse output page order';

  reverseField.append(reverseInput, reverseLabel);

  options.append(rangeField, rotateGroup, reverseField, helper);
  return options;
}

function getRangeLabel(mode) {
  if (mode === 'extract') {
    return 'Extract pages';
  }
  if (mode === 'remove') {
    return 'Remove pages';
  }
  if (mode === 'rotate') {
    return 'Rotate pages';
  }
  if (mode === 'duplicate') {
    return 'Duplicate pages';
  }
  return 'Pages';
}

function getRangePlaceholder(mode, pages) {
  if (mode === 'remove') {
    return 'None';
  }
  if (mode === 'rotate' || mode === 'duplicate') {
    return `All 1-${pages}`;
  }
  return `All 1-${pages}`;
}

function getRangeHelperText(selection, mode) {
  if (mode === 'remove') {
    return `${pluralize(selection.removedCount, 'page')} removed • ${pluralize(selection.indices.length, 'page')} kept`;
  }
  if (mode === 'extract') {
    return `${pluralize(selection.indices.length, 'page')} extracted`;
  }
  if (mode === 'rotate') {
    return `${pluralize(selection.rotatedCount, 'page')} selected for rotation`;
  }
  if (mode === 'duplicate') {
    return `${pluralize(selection.duplicatedCount, 'page')} duplicated • ${pluralize(selection.indices.length, 'output page')}`;
  }
  return `${pluralize(selection.indices.length, 'selected page')}`;
}

function getPreviewButtonText(mode) {
  if (mode === 'extract') {
    return 'Preview extraction';
  }
  if (mode === 'remove') {
    return 'Preview page removal';
  }
  if (mode === 'rotate') {
    return 'Preview rotation';
  }
  if (mode === 'duplicate') {
    return 'Preview duplication';
  }
  return 'Preview combination';
}

function renderToolVisibility(isCombine) {
  setControlHidden(els.coverPage, !isCombine);
  els.coverOptions.hidden = !isCombine;
  setControlHidden(els.separatorPages, !isCombine);
  setControlHidden(els.tocPage, !isCombine);
  els.tocOptions.hidden = !isCombine;
  setControlHidden(els.duplexBlanks, !isCombine);
}

function setControlHidden(input, hidden) {
  const row = input.closest('.check-row');
  if (row) {
    row.hidden = hidden;
  }
}

function renderControls() {
  const disabled = state.busy;
  const toolMode = getToolMode();
  const isCombine = toolMode === 'combine';
  els.addButton.disabled = disabled;
  els.clearButton.disabled = disabled || state.items.length === 0;
  els.previewButton.disabled = disabled || state.items.length === 0 || hasErrors() || hasRangeErrors() || countPending() > 0;
  els.previewButton.textContent = state.busy ? 'Creating preview...' : getPreviewButtonText(toolMode);
  els.dropzone.disabled = disabled;
  els.toolMode.disabled = disabled;
  els.outputName.disabled = disabled;
  els.pageSizeMode.disabled = disabled;
  els.layoutMargin.disabled = disabled || els.pageSizeMode.value === 'original';
  els.blankBeforeCount.disabled = disabled;
  els.blankAfterCount.disabled = disabled;
  els.coverPage.disabled = disabled || !isCombine;
  els.coverTitle.disabled = disabled || !isCombine || !els.coverPage.checked;
  els.coverSubtitle.disabled = disabled || !isCombine || !els.coverPage.checked;
  els.coverOptions.classList.toggle('is-disabled', disabled || !isCombine || !els.coverPage.checked);
  els.separatorPages.disabled = disabled || !isCombine || state.items.length < 2;
  els.tocPage.disabled = disabled || !isCombine;
  els.tocTitle.disabled = disabled || !isCombine || !els.tocPage.checked;
  els.tocOptions.classList.toggle('is-disabled', disabled || !isCombine || !els.tocPage.checked);
  els.duplexBlanks.disabled = disabled || !isCombine || state.items.length < 2;
  els.flattenForms.disabled = disabled;
  els.pageNumbers.disabled = disabled;
  els.pageNumberFormat.disabled = disabled || !els.pageNumbers.checked;
  els.pageNumberPosition.disabled = disabled || !els.pageNumbers.checked;
  els.pageNumberScope.disabled = disabled || !els.pageNumbers.checked;
  els.pageNumberStart.disabled = disabled || !els.pageNumbers.checked;
  els.pageNumberOptions.classList.toggle('is-disabled', disabled || !els.pageNumbers.checked);
  els.sourceLabels.disabled = disabled;
  els.sourceLabelPosition.disabled = disabled || !els.sourceLabels.checked;
  els.sourceLabelOptions.classList.toggle('is-disabled', disabled || !els.sourceLabels.checked);
  els.dateStamp.disabled = disabled;
  els.dateStampText.disabled = disabled || !els.dateStamp.checked;
  els.dateStampPosition.disabled = disabled || !els.dateStamp.checked;
  els.dateStampOptions.classList.toggle('is-disabled', disabled || !els.dateStamp.checked);
  els.metadataTitle.disabled = disabled;
  els.metadataAuthor.disabled = disabled;
  els.metadataSubject.disabled = disabled;
  els.watermarkText.disabled = disabled;
  els.watermarkAngle.disabled = disabled;
  els.watermarkOpacity.disabled = disabled;
  els.watermarkSize.disabled = disabled;
  els.watermarkOpacityValue.textContent = `${els.watermarkOpacity.value}%`;
  els.watermarkSizeValue.textContent = `${els.watermarkSize.value} pt`;
  renderToolVisibility(isCombine);
}

function render() {
  renderSummary();
  renderQueueNote();
  renderList();
  renderControls();
  renderStatus();
  renderPreview();
  renderOutput();
}

function parsePageRanges(value, pageCount) {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      ok: true,
      indices: Array.from({ length: pageCount }, (_, index) => index),
      error: '',
    };
  }

  const indices = [];
  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);

  if (!parts.length) {
    return { ok: false, indices: [], error: 'Enter pages like 1-3,5.' };
  }

  for (const part of parts) {
    const match = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) {
      return { ok: false, indices: [], error: 'Use numbers and ranges like 1-3,5.' };
    }

    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;

    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      return { ok: false, indices: [], error: `Pages must be between 1 and ${pageCount}.` };
    }

    if (start > end) {
      return { ok: false, indices: [], error: 'Range start must be before range end.' };
    }

    for (let page = start; page <= end; page += 1) {
      indices.push(page - 1);
    }
  }

  return { ok: true, indices, error: '' };
}

function resolvePageSelection(value, pageCount, mode) {
  if (mode === 'remove' && !value.trim()) {
    return {
      ok: true,
      indices: Array.from({ length: pageCount }, (_, index) => index),
      removedCount: 0,
      rotatedSet: new Set(),
      duplicatedSet: new Set(),
      rotatedCount: 0,
      duplicatedCount: 0,
      error: '',
    };
  }

  const selection = parsePageRanges(value, pageCount);
  const selectedSet = selection.ok ? new Set(selection.indices) : new Set();
  if (selection.ok && mode === 'rotate') {
    return {
      ok: true,
      indices: Array.from({ length: pageCount }, (_, index) => index),
      removedCount: 0,
      rotatedSet: selectedSet,
      duplicatedSet: new Set(),
      rotatedCount: selectedSet.size,
      duplicatedCount: 0,
      error: '',
    };
  }

  if (selection.ok && mode === 'duplicate') {
    const indices = [];
    for (let index = 0; index < pageCount; index += 1) {
      indices.push(index);
      if (selectedSet.has(index)) {
        indices.push(index);
      }
    }

    return {
      ok: true,
      indices,
      removedCount: 0,
      rotatedSet: new Set(),
      duplicatedSet: selectedSet,
      rotatedCount: 0,
      duplicatedCount: selectedSet.size,
      error: '',
    };
  }

  if (!selection.ok || mode !== 'remove') {
    return {
      ...selection,
      removedCount: 0,
      rotatedSet: new Set(),
      duplicatedSet: new Set(),
      rotatedCount: 0,
      duplicatedCount: 0,
    };
  }

  const removed = selectedSet;
  const indices = Array.from({ length: pageCount }, (_, index) => index).filter((index) => !removed.has(index));

  return {
    ok: true,
    indices,
    removedCount: removed.size,
    rotatedSet: new Set(),
    duplicatedSet: new Set(),
    rotatedCount: 0,
    duplicatedCount: 0,
    error: '',
  };
}

async function inspectFile(item) {
  try {
    const bytes = await item.file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    item.pages = pdf.getPageCount();
  } catch (error) {
    console.error('Failed to inspect PDF:', item.name, error);
    item.error = 'Unreadable PDF';
    item.pages = null;
  } finally {
    render();
  }
}

function addFiles(fileList) {
  const files = [...fileList];
  if (!files.length) {
    return;
  }

  let added = 0;
  let skipped = 0;

  files.forEach((file) => {
    if (!isPdfFile(file)) {
      skipped += 1;
      return;
    }

    const item = {
      id: state.nextId++,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      pages: null,
      error: null,
      range: '',
      reverse: false,
      rotation: 0,
    };

    state.items.push(item);
    if (!state.activeItemId) {
      state.activeItemId = item.id;
    }
    added += 1;
    inspectFile(item);
  });

  if (!added && skipped) {
    setNotice('Only PDF files can be added.');
    return;
  }

  clearOutput();
  state.notice = '';
  render();
}

function moveItem(id, delta) {
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) return;

  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= state.items.length) return;

  const [item] = state.items.splice(index, 1);
  state.items.splice(nextIndex, 0, item);
  clearOutput();
  state.notice = '';
  render();
}

function removeItem(id) {
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) return;

  const [item] = state.items.splice(index, 1);
  revokeItemPreview(item);
  if (state.activeItemId === id) {
    const nextItem = state.items[Math.min(index, state.items.length - 1)] || null;
    state.activeItemId = nextItem?.id || null;
  }
  clearOutput();
  state.notice = '';
  render();
}

function updateRotation(id, rotation) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;

  item.rotation = rotation;
  clearOutput();
  state.notice = '';
  render();
}

function updateReverse(id, reverse) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;

  item.reverse = reverse;
  clearOutput();
  state.notice = '';
  render();
}

function clearQueue() {
  state.items.forEach(revokeItemPreview);
  state.items = [];
  state.activeItemId = null;
  state.notice = '';
  clearOutput();
  render();
}

async function previewCombination() {
  if (state.busy || !state.items.length || hasErrors()) {
    return;
  }

  if (hasRangeErrors()) {
    state.notice = 'Fix the highlighted page range before previewing.';
    render();
    return;
  }

  state.busy = true;
  render();

  try {
    const toolMode = getToolMode();
    const isCombine = toolMode === 'combine';
    const merged = await PDFDocument.create();
    const pageInfos = [];
    applyMetadata(merged);

    const layoutOptions = getLayoutOptions();
    const generatedPageSize = layoutOptions.sizeMode === 'original' ? COVER_PAGE_SIZE : layoutOptions.pageSize;
    const coverOptions = getCoverOptions();
    const tocOptions = getTocOptions();
    const tocPageCount = isCombine && tocOptions.enabled ? getTocPageCount() : 0;
    const frontPageCount = layoutOptions.blankBefore + (isCombine && coverOptions.enabled ? 1 : 0) + tocPageCount;
    const assemblyPlan = buildAssemblyPlan(frontPageCount);

    for (let index = 0; index < layoutOptions.blankBefore; index += 1) {
      addUserBlankPage(merged, generatedPageSize);
      pageInfos.push({ role: 'blank' });
    }

    if (isCombine && coverOptions.enabled) {
      await addCoverPage(merged, coverOptions, generatedPageSize);
      pageInfos.push({ role: 'cover' });
    }

    if (isCombine && tocOptions.enabled) {
      await addTableOfContents(merged, tocOptions, assemblyPlan, generatedPageSize);
      for (let index = 0; index < tocPageCount; index += 1) {
        pageInfos.push({ role: 'toc' });
      }
    }

    for (const section of assemblyPlan) {
      const { item } = section;
      const bytes = await item.file.arrayBuffer();
      const source = await PDFDocument.load(bytes);
      if (els.flattenForms.checked) {
        flattenFormFields(source);
      }

      const selection = resolvePageSelection(item.range, source.getPageCount(), toolMode);
      if (!selection.ok) {
        throw new Error(`${item.name}: ${selection.error}`);
      }

      if (section.blankBefore) {
        await addDuplexBlankPage(merged, generatedPageSize);
        pageInfos.push({ role: 'blank' });
      }

      if (section.separatorPage) {
        await addSeparatorPage(merged, item, section.index + 1, selection.indices.length, generatedPageSize);
        pageInfos.push({ role: 'separator', sourceName: item.name, sectionIndex: section.index });
      }

      const sourceIndices = item.reverse ? [...selection.indices].reverse() : selection.indices;
      const rotationForSourcePage = (sourceIndex) => getOutputPageRotation(item, selection, sourceIndex, toolMode);
      const addedPages = layoutOptions.sizeMode === 'original'
        ? await addCopiedSourcePages(merged, source, sourceIndices, rotationForSourcePage)
        : await addFittedSourcePages(merged, source, sourceIndices, layoutOptions, rotationForSourcePage);

      addedPages.forEach((page, pageIndex) => {
        pageInfos.push({
          role: 'source',
          sourceName: item.name,
          sectionIndex: section.index,
          sourcePage: sourceIndices[pageIndex] + 1,
        });
      });
    }

    for (let index = 0; index < layoutOptions.blankAfter; index += 1) {
      addUserBlankPage(merged, generatedPageSize);
      pageInfos.push({ role: 'blank' });
    }

    await addWatermark(merged);

    if (els.sourceLabels.checked) {
      await addSourceLabels(merged, pageInfos);
    }

    if (els.dateStamp.checked) {
      await addDateStamp(merged, pageInfos);
    }

    if (els.pageNumbers.checked) {
      await addPageNumbers(merged, pageInfos);
    }

    if (!merged.getPageCount()) {
      throw new Error('No pages would be included in the output.');
    }

    const mergedBytes = await merged.save();
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    if (state.downloadUrl) {
      URL.revokeObjectURL(state.downloadUrl);
    }

    state.downloadUrl = url;
    state.outputName = buildOutputName();
    const modifiers = activeModifierLabels();
    const modifierSummary = modifiers.length ? ` • ${modifiers.join(', ')}` : '';
    state.notice = `Preview ready: ${pluralize(state.items.length, 'PDF')} ${getOutputVerb(toolMode)} into ${pluralize(merged.getPageCount(), 'page')}.`;
    state.outputSummary = `${state.outputName} • ${pluralize(merged.getPageCount(), 'page')} • ${formatBytes(blob.size)}${modifierSummary}`;
  } catch (error) {
    console.error('Failed to create PDF preview:', error);
    state.notice = 'Could not create a preview for the selected files.';
    if (state.downloadUrl) {
      URL.revokeObjectURL(state.downloadUrl);
      state.downloadUrl = null;
    }
  } finally {
    state.busy = false;
    render();
  }
}

function applyMetadata(pdf) {
  const options = getMetadataOptions();
  if (options.title) {
    pdf.setTitle(options.title);
  }
  if (options.author) {
    pdf.setAuthor(options.author);
  }
  if (options.subject) {
    pdf.setSubject(options.subject);
  }
  pdf.setCreator('PDF Combiner');
  pdf.setProducer('PDF Combiner');
  pdf.setCreationDate(new Date());
  pdf.setModificationDate(new Date());
}

async function addCoverPage(pdf, options, pageSize = COVER_PAGE_SIZE) {
  const page = pdf.addPage();
  page.setSize(pageSize[0], pageSize[1]);
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  const title = toDrawableText(options.title, 'Merged PDF');
  const subtitle = toDrawableText(options.subtitle);

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.97, 0.98, 1),
  });
  page.drawRectangle({
    x: 0,
    y: height - 92,
    width,
    height: 92,
    color: rgb(0.9, 0.94, 1),
  });

  const titleLines = wrapText(titleFont, title, 34, width - 112).slice(0, 4);
  const titleBlockHeight = titleLines.length * 42;
  drawCenteredLines(page, titleLines, titleFont, 34, height * 0.62 + titleBlockHeight / 2, 42, rgb(0.07, 0.13, 0.22));

  if (subtitle) {
    const subtitleLines = wrapText(bodyFont, subtitle, 15, width - 128).slice(0, 3);
    drawCenteredLines(page, subtitleLines, bodyFont, 15, height * 0.48, 22, rgb(0.28, 0.34, 0.44));
  }

  const details = `${pluralize(state.items.length, 'file')} • ${pluralize(selectedPagesTotal(), 'selected page')}`;
  drawCenteredLines(page, [details], bodyFont, 11, 72, 16, rgb(0.36, 0.4, 0.48));
}

async function addTableOfContents(pdf, options, entries, pageSize = COVER_PAGE_SIZE) {
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  const title = toDrawableText(options.title, 'Table of contents');
  const pageCount = getTocPageCount();

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdf.addPage();
    page.setSize(pageSize[0], pageSize[1]);
    const { width, height } = page.getSize();
    const sliceStart = pageIndex * TOC_ENTRIES_PER_PAGE;
    const pageEntries = entries.slice(sliceStart, sliceStart + TOC_ENTRIES_PER_PAGE);

    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0.98, 0.99, 1),
    });
    page.drawText(pageIndex === 0 ? title : `${title} continued`, {
      x: 54,
      y: height - 76,
      size: 24,
      font: titleFont,
      color: rgb(0.07, 0.13, 0.22),
    });
    page.drawText('Start', {
      x: width - 92,
      y: height - 116,
      size: 9,
      font: titleFont,
      color: rgb(0.32, 0.38, 0.48),
    });
    page.drawText('Pages', {
      x: width - 154,
      y: height - 116,
      size: 9,
      font: titleFont,
      color: rgb(0.32, 0.38, 0.48),
    });
    page.drawLine({
      start: { x: 54, y: height - 126 },
      end: { x: width - 54, y: height - 126 },
      thickness: 1,
      color: rgb(0.78, 0.82, 0.88),
    });

    pageEntries.forEach((entry, index) => {
      const y = height - 154 - index * 26;
      const titleText = truncateText(bodyFont, toDrawableText(stripPdfExtension(entry.item.name), `Section ${entry.index + 1}`), 11, width - 240);
      const detailText = truncateText(bodyFont, entry.rangeLabel, 8, width - 240);

      page.drawText(String(entry.index + 1).padStart(2, '0'), {
        x: 54,
        y,
        size: 10,
        font: titleFont,
        color: rgb(0.14, 0.22, 0.34),
      });
      page.drawText(titleText, {
        x: 86,
        y,
        size: 11,
        font: bodyFont,
        color: rgb(0.07, 0.13, 0.22),
      });
      page.drawText(detailText, {
        x: 86,
        y: y - 11,
        size: 8,
        font: bodyFont,
        color: rgb(0.38, 0.44, 0.54),
      });
      page.drawText(String(entry.selectedCount), {
        x: width - 148,
        y,
        size: 10,
        font: bodyFont,
        color: rgb(0.14, 0.22, 0.34),
      });
      page.drawText(String(entry.sectionStartPage), {
        x: width - 86,
        y,
        size: 10,
        font: bodyFont,
        color: rgb(0.14, 0.22, 0.34),
      });
    });

    page.drawText(`${pageIndex + 1} / ${pageCount}`, {
      x: width - 78,
      y: 42,
      size: 9,
      font: bodyFont,
      color: rgb(0.38, 0.44, 0.54),
    });
  }
}

async function addSeparatorPage(pdf, item, sectionNumber, selectedCount, pageSize = COVER_PAGE_SIZE) {
  const page = pdf.addPage();
  page.setSize(pageSize[0], pageSize[1]);
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  const sectionLabel = `Section ${sectionNumber}`;
  const fileTitle = toDrawableText(stripPdfExtension(item.name), sectionLabel);
  const pageCount = pluralize(selectedCount, 'selected page');

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.99, 0.99, 0.98),
  });
  page.drawLine({
    start: { x: 96, y: height * 0.58 },
    end: { x: width - 96, y: height * 0.58 },
    thickness: 1,
    color: rgb(0.78, 0.82, 0.88),
  });

  drawCenteredLines(page, [sectionLabel], bodyFont, 13, height * 0.64, 18, rgb(0.25, 0.32, 0.42));
  const titleLines = wrapText(titleFont, fileTitle, 26, width - 132).slice(0, 3);
  drawCenteredLines(page, titleLines, titleFont, 26, height * 0.52 + titleLines.length * 16, 34, rgb(0.07, 0.13, 0.22));
  drawCenteredLines(page, [pageCount], bodyFont, 11, height * 0.38, 16, rgb(0.36, 0.4, 0.48));
}

async function addDuplexBlankPage(pdf, pageSize = COVER_PAGE_SIZE) {
  const page = pdf.addPage();
  page.setSize(pageSize[0], pageSize[1]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  drawCenteredLines(page, ['Intentionally blank'], font, 11, pageSize[1] / 2, 16, rgb(0.56, 0.6, 0.68));
}

function addUserBlankPage(pdf, pageSize = COVER_PAGE_SIZE) {
  const page = pdf.addPage();
  page.setSize(pageSize[0], pageSize[1]);
  return page;
}

function getOutputPageRotation(item, selection, sourceIndex, toolMode) {
  if (!item.rotation) {
    return 0;
  }
  if (toolMode === 'rotate' && !selection.rotatedSet.has(sourceIndex)) {
    return 0;
  }
  return item.rotation;
}

async function addCopiedSourcePages(pdf, source, sourceIndices, getRotation) {
  const pages = await pdf.copyPages(source, sourceIndices);
  pages.forEach((page, index) => {
    const rotation = getRotation(sourceIndices[index], index);
    if (rotation) {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees(normalizeRotation(currentRotation + rotation)));
    }
    pdf.addPage(page);
  });
  return pages;
}

async function addFittedSourcePages(pdf, source, sourceIndices, layoutOptions, getRotation) {
  const pages = [];

  for (let index = 0; index < sourceIndices.length; index += 1) {
    const sourceIndex = sourceIndices[index];
    const sourcePage = source.getPage(sourceIndex);
    const embeddedPage = await pdf.embedPage(sourcePage);
    const page = pdf.addPage();
    page.setSize(layoutOptions.pageSize[0], layoutOptions.pageSize[1]);
    drawFittedEmbeddedPage(page, embeddedPage, layoutOptions.margin);

    const rotation = getRotation(sourceIndex, index);
    if (rotation) {
      page.setRotation(degrees(rotation));
    }

    pages.push(page);
  }

  return pages;
}

function drawFittedEmbeddedPage(page, embeddedPage, margin) {
  const { width, height } = page.getSize();
  const safeMargin = Math.min(margin, width / 3, height / 3);
  const maxWidth = Math.max(1, width - safeMargin * 2);
  const maxHeight = Math.max(1, height - safeMargin * 2);
  const scale = Math.min(maxWidth / embeddedPage.width, maxHeight / embeddedPage.height);
  const drawWidth = embeddedPage.width * scale;
  const drawHeight = embeddedPage.height * scale;

  page.drawPage(embeddedPage, {
    x: (width - drawWidth) / 2,
    y: (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });
}

function flattenFormFields(pdf) {
  try {
    const form = pdf.getForm();
    if (form.getFields().length) {
      form.flatten();
    }
  } catch (error) {
    console.warn('Could not flatten form fields:', error);
  }
}

function drawCenteredLines(page, lines, font, size, startY, lineHeight, color) {
  const { width } = page.getSize();
  lines.forEach((line, index) => {
    const textWidth = font.widthOfTextAtSize(line, size);
    page.drawText(line, {
      x: Math.max(36, (width - textWidth) / 2),
      y: startY - index * lineHeight,
      size,
      font,
      color,
    });
  });
}

function wrapText(font, text, size, maxWidth) {
  const words = text.split(' ').filter(Boolean);
  const lines = [];
  let line = '';

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      return;
    }

    if (line) {
      lines.push(line);
      line = '';
    }

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;
      return;
    }

    const chunks = breakLongWord(font, word, size, maxWidth);
    lines.push(...chunks.slice(0, -1));
    line = chunks[chunks.length - 1] || '';
  });

  if (line) {
    lines.push(line);
  }
  return lines.length ? lines : [''];
}

function truncateText(font, text, size, maxWidth) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) {
    return text;
  }

  const ellipsis = '...';
  let trimmed = text;
  while (trimmed.length > 0 && font.widthOfTextAtSize(`${trimmed}${ellipsis}`, size) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed ? `${trimmed}${ellipsis}` : ellipsis;
}

function breakLongWord(font, word, size, maxWidth) {
  const chunks = [];
  let chunk = '';
  [...word].forEach((char) => {
    const candidate = `${chunk}${char}`;
    if (chunk && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      chunks.push(chunk);
      chunk = char;
      return;
    }
    chunk = candidate;
  });
  if (chunk) {
    chunks.push(chunk);
  }
  return chunks;
}

async function addWatermark(pdf) {
  const options = getWatermarkOptions();
  if (!options.text) {
    return;
  }

  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  pages.forEach((page) => {
    const displaySize = getDisplaySize(page);
    const size = fitWatermarkSize(font, options.text, options.size, displaySize.width, displaySize.height);
    const placement = getWatermarkPlacement(page, font, options.text, size, options.angle);

    page.drawText(options.text, {
      x: placement.x,
      y: placement.y,
      size,
      font,
      color: rgb(0.16, 0.2, 0.28),
      opacity: options.opacity,
      rotate: placement.rotate,
    });
  });
}

function getWatermarkPlacement(page, font, text, size, angle) {
  const { width, height } = page.getSize();
  const rotation = normalizeRotation(page.getRotation().angle);
  const displaySize = getDisplaySize(page);
  const textWidth = font.widthOfTextAtSize(text, size);
  const displayX = Math.max(0, (displaySize.width - textWidth) / 2);
  const displayY = Math.max(0, (displaySize.height - size) / 2);
  const point = pagePointFromDisplayPoint(width, height, rotation, displayX, displayY);

  return {
    x: point.x,
    y: point.y,
    rotate: degrees(rotation + angle),
  };
}

function fitWatermarkSize(font, text, requestedSize, pageWidth, pageHeight) {
  const maxWidth = Math.min(pageWidth, pageHeight) * 0.92;
  const textWidth = font.widthOfTextAtSize(text, requestedSize);

  if (textWidth <= maxWidth) {
    return requestedSize;
  }

  return Math.max(18, requestedSize * (maxWidth / textWidth));
}

async function addSourceLabels(pdf, pageInfos = []) {
  const options = getSourceLabelOptions();
  if (!options.enabled) {
    return;
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const size = 8;

  pages.forEach((page, index) => {
    const info = pageInfos[index];
    if (info?.role !== 'source') {
      return;
    }

    const displaySize = getDisplaySize(page);
    const baseLabel = `${stripPdfExtension(info.sourceName)} - p.${info.sourcePage}`;
    const label = truncateText(font, toDrawableText(baseLabel), size, displaySize.width - 36);
    const placement = getDisplayTextPlacement(page, font, label, size, options.position, 18);

    page.drawText(label, {
      x: placement.x,
      y: placement.y,
      size,
      font,
      color: rgb(0.36, 0.42, 0.52),
      rotate: placement.rotate,
    });
  });
}

async function addDateStamp(pdf, pageInfos = []) {
  const options = getDateStampOptions();
  if (!options.enabled || !options.text) {
    return;
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const size = 8;

  pages.forEach((page, index) => {
    const info = pageInfos[index];
    if (info?.role === 'cover') {
      return;
    }

    const displaySize = getDisplaySize(page);
    const label = truncateText(font, options.text, size, displaySize.width - 36);
    const placement = getDisplayTextPlacement(page, font, label, size, options.position, 18);

    page.drawText(label, {
      x: placement.x,
      y: placement.y,
      size,
      font,
      color: rgb(0.36, 0.42, 0.52),
      rotate: placement.rotate,
    });
  });
}

async function addPageNumbers(pdf, pageInfos = []) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const options = getPageNumberOptions();
  const numberedPages = pages
    .map((page, index) => ({ page, index, info: pageInfos[index] || { role: 'source' } }))
    .filter((entry) => shouldNumberPage(entry.info, options.scope));
  const total = numberedPages.length;

  numberedPages.forEach(({ page }, index) => {
    const pageNumber = options.start + index;
    const label = formatPageNumber(pageNumber, options.start + total - 1, options.format);
    const size = 10;
    const placement = getPageNumberPlacement(page, font, label, size, options.position);

    page.drawText(label, {
      x: placement.x,
      y: placement.y,
      size,
      font,
      color: rgb(0.22, 0.27, 0.36),
      rotate: placement.rotate,
    });
  });
}

function shouldNumberPage(info, scope) {
  if (scope === 'source-only') {
    return info.role === 'source';
  }
  if (scope === 'skip-front') {
    return info.role !== 'cover' && info.role !== 'toc';
  }
  return true;
}

function formatPageNumber(pageNumber, total, format) {
  if (format === 'page-current') {
    return `Page ${pageNumber}`;
  }
  if (format === 'current') {
    return String(pageNumber);
  }
  return `${pageNumber} / ${total}`;
}

function getPageNumberPlacement(page, font, label, size, position) {
  return getDisplayTextPlacement(page, font, label, size, position || 'bottom-center', 18);
}

function getDisplayTextPlacement(page, font, label, size, position, margin) {
  const placement = position || 'bottom-center';
  const rotation = normalizeRotation(page.getRotation().angle);
  const { width, height } = page.getSize();
  const displaySize = getDisplaySize(page);
  const textWidth = font.widthOfTextAtSize(label, size);
  const alignLeft = placement.endsWith('left');
  const alignRight = placement.endsWith('right');
  const alignTop = placement.startsWith('top');
  const centeredX = (displaySize.width - textWidth) / 2;
  const rightX = displaySize.width - margin - textWidth;
  const topY = displaySize.height - margin - size;
  const displayX = Math.max(margin, alignLeft ? margin : alignRight ? rightX : centeredX);
  const displayY = Math.max(margin, alignTop ? topY : margin);
  const point = pagePointFromDisplayPoint(width, height, rotation, displayX, displayY);

  return {
    x: point.x,
    y: point.y,
    rotate: degrees(rotation),
  };
}

function getDisplaySize(page) {
  const { width, height } = page.getSize();
  const rotation = normalizeRotation(page.getRotation().angle);
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

function pagePointFromDisplayPoint(width, height, rotation, displayX, displayY) {
  switch (rotation) {
    case 90:
      return { x: width - displayY, y: displayX };
    case 180:
      return { x: width - displayX, y: height - displayY };
    case 270:
      return { x: displayY, y: height - displayX };
    default:
      return { x: displayX, y: displayY };
  }
}

function normalizeRotation(angle) {
  return ((Math.round(angle) % 360) + 360) % 360;
}

function openFilePicker() {
  if (!state.busy) {
    els.fileInput.click();
  }
}

els.addButton.addEventListener('click', openFilePicker);
els.dropzone.addEventListener('click', openFilePicker);
els.fileInput.addEventListener('change', (event) => {
  addFiles(event.target.files);
  event.target.value = '';
});
els.clearButton.addEventListener('click', clearQueue);
els.previewButton.addEventListener('click', previewCombination);
els.outputName.addEventListener('input', () => {
  if (state.downloadUrl) {
    clearOutput();
    state.notice = '';
    render();
  }
});
els.toolMode.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.pageSizeMode.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.layoutMargin.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.blankBeforeCount.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.blankAfterCount.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.coverPage.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.coverTitle.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.coverSubtitle.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.separatorPages.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.tocPage.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.tocTitle.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.duplexBlanks.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.flattenForms.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.pageNumbers.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.pageNumberFormat.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.pageNumberPosition.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.pageNumberScope.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.pageNumberStart.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.sourceLabels.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.sourceLabelPosition.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.dateStamp.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.dateStampText.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.dateStampPosition.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.watermarkText.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.watermarkAngle.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.metadataTitle.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.metadataAuthor.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.metadataSubject.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.watermarkOpacity.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.watermarkSize.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});

['dragenter', 'dragover'].forEach((eventName) => {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!state.busy) {
      els.dropzone.classList.add('is-dragging');
    }
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    els.dropzone.classList.remove('is-dragging');
  });
});

window.addEventListener('drop', (event) => {
  if (state.busy) return;
  const files = event.dataTransfer?.files;
  if (files?.length) {
    addFiles(files);
  }
});

render();
