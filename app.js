const { PDFDocument, StandardFonts, degrees, rgb } = PDFLib;
const COVER_PAGE_SIZE = [595.28, 841.89];
const PAGE_SIZES = {
  a4: COVER_PAGE_SIZE,
  letter: [612, 792],
};
const TOC_ENTRIES_PER_PAGE = 24;
const IMAGE_ANALYSIS_MAX_EDGE = 960;
const IMAGE_OUTPUT_MAX_EDGE = 2200;
const IMAGE_EDGE_POINT_LIMIT = 12000;

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
  imageAutoButton: document.getElementById('image-auto-btn'),
  imageChooseButton: document.getElementById('image-choose-btn'),
  imageClearButton: document.getElementById('image-clear-btn'),
  imageDownloadAllButton: document.getElementById('image-download-all-btn'),
  imageDownloadButton: document.getElementById('image-download-btn'),
  imageDropHint: document.getElementById('image-drop-hint'),
  imageDropzone: document.getElementById('image-dropzone'),
  imageInput: document.getElementById('image-input'),
  imageList: document.getElementById('image-list'),
  imageOutputCanvas: document.getElementById('image-output-canvas'),
  imageOutputPlaceholder: document.getElementById('image-output-placeholder'),
  imageResetCornersButton: document.getElementById('image-reset-corners-btn'),
  imageRotateLeftButton: document.getElementById('image-rotate-left-btn'),
  imageRotateRightButton: document.getElementById('image-rotate-right-btn'),
  imageSourceCanvas: document.getElementById('image-source-canvas'),
  imageSourcePlaceholder: document.getElementById('image-source-placeholder'),
  imageStatus: document.getElementById('image-status'),
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
  pageGrid: document.getElementById('page-grid'),
  pageSelectionNote: document.getElementById('page-selection-note'),
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
  selectAllPages: document.getElementById('select-all-pages'),
  selectNoPages: document.getElementById('select-no-pages'),
  invertPageSelection: document.getElementById('invert-page-selection'),
  insertBlankAfterPages: document.getElementById('insert-blank-after-pages'),
  clearInsertedBlanks: document.getElementById('clear-inserted-blanks'),
  stampImageButton: document.getElementById('stamp-image-button'),
  stampImageEnabled: document.getElementById('stamp-image-enabled'),
  stampImageFile: document.getElementById('stamp-image-file'),
  stampImageName: document.getElementById('stamp-image-name'),
  stampImageOptions: document.getElementById('stamp-image-options'),
  stampImagePosition: document.getElementById('stamp-image-position'),
  stampImageSize: document.getElementById('stamp-image-size'),
  stampImageSizeValue: document.getElementById('stamp-image-size-value'),
  stampText: document.getElementById('stamp-text'),
  stampTextEnabled: document.getElementById('stamp-text-enabled'),
  stampTextOptions: document.getElementById('stamp-text-options'),
  stampTextPosition: document.getElementById('stamp-text-position'),
  stampTextSize: document.getElementById('stamp-text-size'),
  stampTextSizeValue: document.getElementById('stamp-text-size-value'),
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
  stampImage: null,
  imageTool: {
    items: [],
    nextId: 1,
    activeId: null,
    draggingHandle: null,
    processing: false,
    status: 'Ready for an image.',
  },
};

function isPdfFile(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isImageFile(file) {
  return /^image\/(png|jpe?g|webp)$/i.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
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

function buildRectifiedImageName(fileName) {
  const baseName = fileName.replace(/\.[^.]+$/, '').trim() || 'image';
  const safeName = baseName.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'image';
  return `${safeName}-rectified.png`;
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

function getTextStampOptions() {
  return {
    enabled: els.stampTextEnabled.checked,
    text: toDrawableText(els.stampText.value),
    position: els.stampTextPosition.value || 'center',
    size: clampInteger(els.stampTextSize.value, 8, 72, 18),
  };
}

function getImageStampOptions() {
  return {
    enabled: els.stampImageEnabled.checked,
    image: state.stampImage,
    position: els.stampImagePosition.value || 'center',
    widthPercent: clampInteger(els.stampImageSize.value, 8, 90, 28),
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
  if (state.items.some((item) => item.blankAfterPages?.size)) {
    labels.push('inserted blank pages');
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
  if (getTextStampOptions().enabled && getTextStampOptions().text) {
    labels.push('text stamps');
  }
  if (getImageStampOptions().enabled && getImageStampOptions().image) {
    labels.push('image stamps');
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
    return sum + selection.indices.length + countInsertedBlanks(item, selection.indices);
  }, 0);
}

function countInsertedBlanks(item, sourceIndices) {
  if (!item.blankAfterPages?.size) {
    return 0;
  }
  return sourceIndices.reduce((count, sourceIndex) => count + (item.blankAfterPages.has(sourceIndex) ? 1 : 0), 0);
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
    const selectedCount = selection.ok ? selection.indices.length + countInsertedBlanks(item, selection.indices) : 0;
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

function renderPageWorkspace() {
  els.pageGrid.innerHTML = '';
  const activeItem = getActiveItem();
  const disabled = state.busy || !activeItem || activeItem.error || typeof activeItem.pages !== 'number';
  els.selectAllPages.disabled = disabled;
  els.selectNoPages.disabled = disabled;
  els.invertPageSelection.disabled = disabled;
  els.insertBlankAfterPages.disabled = disabled;
  els.clearInsertedBlanks.disabled = disabled || !activeItem?.blankAfterPages?.size;

  if (!activeItem) {
    els.pageSelectionNote.textContent = 'Open a PDF to select pages visually.';
    els.pageGrid.append(buildPageGridMessage('No document selected.'));
    return;
  }

  if (activeItem.error) {
    els.pageSelectionNote.textContent = 'Replace this PDF before selecting pages.';
    els.pageGrid.append(buildPageGridMessage(activeItem.error));
    return;
  }

  if (typeof activeItem.pages !== 'number') {
    els.pageSelectionNote.textContent = 'Reading page details...';
    els.pageGrid.append(buildPageGridMessage('Reading pages...'));
    return;
  }

  const toolMode = getToolMode();
  const selection = resolveTileSelection(activeItem, toolMode);
  if (!selection.ok) {
    els.pageSelectionNote.textContent = selection.error;
  } else {
    const selectedCount = selection.set.size;
    const blankCount = activeItem.blankAfterPages?.size || 0;
    const selectedText = selectedCount === activeItem.pages && toolMode !== 'remove'
      ? 'All pages selected'
      : `${pluralize(selectedCount, 'page')} selected`;
    const blankText = blankCount ? ` • ${pluralize(blankCount, 'inserted blank')}` : '';
    els.pageSelectionNote.textContent = `${selectedText} for ${getToolActionLabel(toolMode)}${blankText}.`;
  }

  for (let index = 0; index < activeItem.pages; index += 1) {
    const selected = selection.ok && selection.set.has(index);
    const hasBlank = activeItem.blankAfterPages?.has(index);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `page-tile${selected ? ' is-selected' : ''}${hasBlank ? ' has-blank-after' : ''}`;
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    button.setAttribute('aria-label', `Page ${index + 1}${selected ? ', selected' : ''}`);
    button.disabled = state.busy;
    button.addEventListener('click', () => toggleActivePageSelection(index));

    const thumbnail = document.createElement('span');
    thumbnail.className = 'page-thumbnail';
    thumbnail.textContent = String(index + 1);

    const label = document.createElement('span');
    label.className = 'page-tile-label';
    label.textContent = hasBlank ? `Page ${index + 1} + blank` : `Page ${index + 1}`;

    button.append(thumbnail, label);
    els.pageGrid.append(button);
  }
}

function buildPageGridMessage(message) {
  const empty = document.createElement('div');
  empty.className = 'page-grid-empty';
  empty.textContent = message;
  return empty;
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

    if (item.blankAfterPages?.size) {
      const blanks = document.createElement('span');
      blanks.textContent = pluralize(item.blankAfterPages.size, 'inserted blank');
      meta.append(blanks);
    }

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
  els.stampTextEnabled.disabled = disabled;
  els.stampText.disabled = disabled || !els.stampTextEnabled.checked;
  els.stampTextPosition.disabled = disabled || !els.stampTextEnabled.checked;
  els.stampTextSize.disabled = disabled || !els.stampTextEnabled.checked;
  els.stampTextOptions.classList.toggle('is-disabled', disabled || !els.stampTextEnabled.checked);
  els.stampTextSizeValue.textContent = `${els.stampTextSize.value} pt`;
  els.stampImageEnabled.disabled = disabled;
  els.stampImageButton.disabled = disabled || !els.stampImageEnabled.checked;
  els.stampImagePosition.disabled = disabled || !els.stampImageEnabled.checked;
  els.stampImageSize.disabled = disabled || !els.stampImageEnabled.checked;
  els.stampImageOptions.classList.toggle('is-disabled', disabled || !els.stampImageEnabled.checked);
  els.stampImageName.textContent = state.stampImage?.name || 'No image selected.';
  els.stampImageSizeValue.textContent = `${els.stampImageSize.value}%`;
  els.watermarkText.disabled = disabled;
  els.watermarkAngle.disabled = disabled;
  els.watermarkOpacity.disabled = disabled;
  els.watermarkSize.disabled = disabled;
  els.watermarkOpacityValue.textContent = `${els.watermarkOpacity.value}%`;
  els.watermarkSizeValue.textContent = `${els.watermarkSize.value} pt`;
  renderToolVisibility(isCombine);
}

function renderImageTool() {
  const tool = state.imageTool;
  const activeItem = getActiveImageItem();
  const hasImage = Boolean(activeItem?.image);
  const hasOutput = Boolean(activeItem?.outputUrl);
  const outputCount = tool.items.filter((item) => item.outputUrl).length;
  els.imageDropHint.textContent = tool.items.length
    ? `${pluralize(tool.items.length, 'image')} queued.`
    : 'No image selected.';
  els.imageDropzone.disabled = tool.processing;
  els.imageChooseButton.disabled = tool.processing;
  els.imageClearButton.disabled = tool.processing || tool.items.length === 0;
  els.imageAutoButton.disabled = tool.processing || !hasImage;
  els.imageRotateLeftButton.disabled = tool.processing || !hasImage;
  els.imageRotateRightButton.disabled = tool.processing || !hasImage;
  els.imageResetCornersButton.disabled = tool.processing || !hasImage;
  els.imageDownloadButton.disabled = tool.processing || !hasOutput;
  els.imageDownloadAllButton.disabled = tool.processing || outputCount === 0;
  els.imageStatus.textContent = tool.status;
  els.imageSourceCanvas.hidden = !hasImage;
  els.imageSourcePlaceholder.hidden = hasImage;
  els.imageOutputCanvas.hidden = !hasOutput;
  els.imageOutputPlaceholder.hidden = hasOutput;
  renderImageList();
}

function renderImageList() {
  els.imageList.innerHTML = '';
  state.imageTool.items.forEach((item) => {
    const row = document.createElement('div');
    row.className = `image-list-item${item.id === state.imageTool.activeId ? ' is-active' : ''}`;

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'image-list-main';
    main.disabled = state.imageTool.processing;
    main.addEventListener('click', () => setActiveImageItem(item.id));

    const name = document.createElement('span');
    name.className = 'image-list-name';
    name.title = item.fileName;
    name.textContent = item.fileName;

    const meta = document.createElement('span');
    meta.className = 'image-list-meta';
    meta.textContent = getImageItemMeta(item);

    main.append(name, meta);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon-btn';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${item.fileName}`);
    remove.disabled = state.imageTool.processing;
    remove.addEventListener('click', () => removeImageItem(item.id));

    row.append(main, remove);
    els.imageList.append(row);
  });
}

function render() {
  renderSummary();
  renderQueueNote();
  renderList();
  renderPageWorkspace();
  renderControls();
  renderImageTool();
  renderStatus();
  renderPreview();
  renderOutput();
}

function parsePageRanges(value, pageCount) {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === 'none') {
    return {
      ok: true,
      indices: [],
      error: '',
    };
  }

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

function resolveTileSelection(item, mode = getToolMode()) {
  if (!item || typeof item.pages !== 'number') {
    return { ok: false, set: new Set(), error: 'No page details available.' };
  }

  if (mode === 'remove' && !item.range.trim()) {
    return { ok: true, set: new Set(), error: '' };
  }

  const selection = parsePageRanges(item.range, item.pages);
  return {
    ok: selection.ok,
    set: new Set(selection.ok ? selection.indices : []),
    error: selection.error,
  };
}

function formatPageRange(indices, pageCount, mode = getToolMode()) {
  const sorted = [...new Set(indices)].filter((index) => index >= 0 && index < pageCount).sort((a, b) => a - b);
  if (!sorted.length) {
    return mode === 'remove' ? '' : 'none';
  }
  if (mode !== 'remove' && sorted.length === pageCount) {
    return '';
  }

  const ranges = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (let index = 1; index <= sorted.length; index += 1) {
    const current = sorted[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }

    ranges.push(start === previous ? String(start + 1) : `${start + 1}-${previous + 1}`);
    start = current;
    previous = current;
  }

  return ranges.join(',');
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
      blankAfterPages: new Set(),
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

function updateActivePageRange(indices) {
  const item = getActiveItem();
  if (!item || typeof item.pages !== 'number') return;

  item.range = formatPageRange(indices, item.pages, getToolMode());
  clearOutput();
  state.notice = '';
  render();
}

function toggleActivePageSelection(pageIndex) {
  const item = getActiveItem();
  if (!item || typeof item.pages !== 'number') return;

  const selection = resolveTileSelection(item);
  if (!selection.ok) return;

  if (selection.set.has(pageIndex)) {
    selection.set.delete(pageIndex);
  } else {
    selection.set.add(pageIndex);
  }

  updateActivePageRange(selection.set);
}

function selectActivePages(mode) {
  const item = getActiveItem();
  if (!item || typeof item.pages !== 'number') return;

  const selection = resolveTileSelection(item);
  const selected = selection.ok ? selection.set : new Set();

  if (mode === 'all') {
    updateActivePageRange(Array.from({ length: item.pages }, (_, index) => index));
    return;
  }

  if (mode === 'none') {
    updateActivePageRange([]);
    return;
  }

  const inverted = [];
  for (let index = 0; index < item.pages; index += 1) {
    if (!selected.has(index)) {
      inverted.push(index);
    }
  }
  updateActivePageRange(inverted);
}

function insertBlankAfterSelectedPages() {
  const item = getActiveItem();
  if (!item || typeof item.pages !== 'number') return;

  const selection = resolveTileSelection(item);
  const targets = selection.ok && selection.set.size
    ? [...selection.set]
    : [item.pages - 1];

  targets.forEach((pageIndex) => item.blankAfterPages.add(pageIndex));
  clearOutput();
  state.notice = 'Blank page insertion updated.';
  render();
}

function clearInsertedBlanks() {
  const item = getActiveItem();
  if (!item?.blankAfterPages?.size) return;

  item.blankAfterPages.clear();
  clearOutput();
  state.notice = 'Inserted blank pages cleared.';
  render();
}

async function updateStampImage(file) {
  if (!file) return;

  const isSupported = file.type === 'image/png' || file.type === 'image/jpeg' || /\.(png|jpe?g)$/i.test(file.name);
  if (!isSupported) {
    state.notice = 'Use a PNG or JPG image for image stamps.';
    render();
    return;
  }

  state.stampImage = {
    name: file.name,
    type: file.type === 'image/png' || /\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg',
    bytes: await file.arrayBuffer(),
  };
  clearOutput();
  state.notice = '';
  render();
}

function getActiveImageItem() {
  const { items, activeId } = state.imageTool;
  if (!items.length) {
    return null;
  }
  return items.find((item) => item.id === activeId) || items[0];
}

function setActiveImageItem(id) {
  if (state.imageTool.activeId === id) {
    return;
  }

  state.imageTool.activeId = id;
  const item = getActiveImageItem();
  state.imageTool.status = item ? getImageItemStatus(item) : 'Ready for an image.';
  drawActiveImagePreviews();
  render();
}

function getImageItemMeta(item) {
  const parts = [`${item.sourceWidth} x ${item.sourceHeight}px`];
  if (item.rotation) {
    parts.push(`${item.rotation} deg`);
  }
  parts.push(item.outputUrl ? 'ready' : item.corners ? 'corners set' : 'not extracted');
  return parts.join(' - ');
}

function getImageItemStatus(item) {
  if (!item) {
    return 'Ready for an image.';
  }
  if (item.outputUrl) {
    return `${item.fileName} ready at ${item.outputWidth} x ${item.outputHeight}px.`;
  }
  if (item.corners) {
    return `${item.fileName} has editable ${hasActiveCurve(item) ? 'curves' : 'corners'}.`;
  }
  return `${item.fileName} loaded.`;
}

function clearImageItemOutput(item, clearCorners = false) {
  if (!item) return;
  if (item.outputUrl) {
    URL.revokeObjectURL(item.outputUrl);
  }
  item.outputUrl = null;
  item.outputBlob = null;
  item.outputName = buildRectifiedImageName(item.fileName);
  item.outputWidth = 0;
  item.outputHeight = 0;
  if (clearCorners) {
    item.corners = null;
    item.curvePoints = null;
    item.fallback = false;
  }
}

function clearImageOutputOnly(item) {
  clearImageItemOutput(item, false);
}

function clearImageOutputCanvas() {
  els.imageOutputCanvas.width = 0;
  els.imageOutputCanvas.height = 0;
}

function getImageNaturalSize(image) {
  return {
    width: image.naturalWidth || image.videoWidth || image.width,
    height: image.naturalHeight || image.videoHeight || image.height,
  };
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image could not be loaded.'));
    };
    image.src = url;
  });
}

async function addRectifierImages(fileList) {
  const files = [...(fileList || [])];
  const imageFiles = files.filter(isImageFile);
  if (!imageFiles.length) {
    state.imageTool.status = files.length ? 'Use JPG, PNG, or WebP images.' : 'Ready for an image.';
    render();
    return;
  }

  state.imageTool.processing = true;
  state.imageTool.status = `Loading ${pluralize(imageFiles.length, 'image')}...`;
  render();

  const newItems = [];
  for (const file of imageFiles) {
    try {
      const image = await loadImageElement(file);
      const { width, height } = getImageNaturalSize(image);
      if (!width || !height) {
        throw new Error('Image has no readable dimensions.');
      }

      const item = {
        id: state.imageTool.nextId++,
        fileName: file.name,
        image,
        sourceWidth: width,
        sourceHeight: height,
        rotation: 0,
        corners: null,
        curvePoints: null,
        fallback: false,
        outputUrl: null,
        outputBlob: null,
        outputName: buildRectifiedImageName(file.name),
        outputWidth: 0,
        outputHeight: 0,
      };
      state.imageTool.items.push(item);
      newItems.push(item);
      if (!state.imageTool.activeId) {
        state.imageTool.activeId = item.id;
      }
    } catch (error) {
      console.error('Failed to load image:', file.name, error);
    }
  }

  state.imageTool.processing = false;
  if (!newItems.length) {
    state.imageTool.status = 'Could not load those images.';
    render();
    return;
  }

  drawActiveImagePreviews();
  state.imageTool.status = `Loaded ${pluralize(newItems.length, 'image')}. Auto extracting...`;
  render();
  await processImageItems(newItems, true);
}

async function processRectifierImage() {
  const item = getActiveImageItem();
  if (!item || state.imageTool.processing) {
    return;
  }
  await processImageItem(item, { detect: true });
}

async function processImageItems(items, detect) {
  state.imageTool.processing = true;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    state.imageTool.status = `Extracting ${index + 1} of ${items.length}: ${item.fileName}`;
    render();
    await waitForFrame();
    await processImageItem(item, { detect, keepBusy: true });
  }
  state.imageTool.processing = false;
  const activeItem = getActiveImageItem();
  state.imageTool.status = activeItem ? getImageItemStatus(activeItem) : 'Ready for an image.';
  drawActiveImagePreviews();
  render();
}

async function processImageItem(item, { detect = false, keepBusy = false } = {}) {
  if (!item?.image) {
    return;
  }

  const startedIdle = !state.imageTool.processing;
  if (startedIdle) {
    state.imageTool.processing = true;
  }

  if (item.id === state.imageTool.activeId) {
    state.imageTool.status = detect ? 'Detecting document edges...' : 'Aligning image...';
    clearImageOutputCanvas();
    drawImageSourcePreview(item);
    render();
    await waitForFrame();
  }

  try {
    const source = getPreparedImageSource(item);
    clearImageItemOutput(item, detect);

    if (detect || !item.corners) {
      const detection = detectDocumentCorners(source);
      item.corners = detection.corners;
      item.curvePoints = null;
      item.fallback = detection.fallback;
    } else {
      const { width, height } = getImageNaturalSize(source);
      item.fallback = isFullImageQuad(item.corners, width, height);
    }

    if (item.id === state.imageTool.activeId) {
      drawImageSourcePreview(item);
      render();
      await waitForFrame();
    }

    const result = warpImageToRectangle(source, item.corners, item.curvePoints);
    const outputCanvas = item.id === state.imageTool.activeId ? els.imageOutputCanvas : document.createElement('canvas');
    outputCanvas.width = result.width;
    outputCanvas.height = result.height;
    outputCanvas.getContext('2d').putImageData(result.imageData, 0, 0);

    const blob = await canvasToBlob(outputCanvas, 'image/png');
    item.outputUrl = URL.createObjectURL(blob);
    item.outputBlob = blob;
    item.outputWidth = result.width;
    item.outputHeight = result.height;
    item.outputName = buildRectifiedImageName(item.fileName);

    if (item.id === state.imageTool.activeId) {
      state.imageTool.status = item.fallback
        ? `Aligned full image to ${result.width} x ${result.height}px.`
        : `${hasActiveCurve(item) ? 'Extracted curved boundary' : 'Extracted trapezoid'} and aligned to ${result.width} x ${result.height}px.`;
    }
  } catch (error) {
    console.error('Failed to rectify image:', item.fileName, error);
    clearImageItemOutput(item);
    if (item.id === state.imageTool.activeId) {
      clearImageOutputCanvas();
      state.imageTool.status = 'Could not extract a rectangle from that image.';
    }
  } finally {
    if (startedIdle && !keepBusy) {
      state.imageTool.processing = false;
    }
    if (!keepBusy) {
      render();
    }
  }
}

function getPreparedImageSource(item) {
  const rotation = normalizeRotation(item.rotation || 0);
  if (!rotation) {
    return item.image;
  }

  const { width, height } = getImageNaturalSize(item.image);
  const canvas = document.createElement('canvas');
  canvas.width = rotation === 90 || rotation === 270 ? height : width;
  canvas.height = rotation === 90 || rotation === 270 ? width : height;
  const context = canvas.getContext('2d');
  context.save();

  if (rotation === 90) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    context.translate(canvas.width, canvas.height);
    context.rotate(Math.PI);
  } else if (rotation === 270) {
    context.translate(0, canvas.height);
    context.rotate(-Math.PI / 2);
  }

  context.drawImage(item.image, 0, 0, width, height);
  context.restore();
  return canvas;
}

function drawActiveImagePreviews() {
  const item = getActiveImageItem();
  if (!item) {
    els.imageSourceCanvas.width = 0;
    els.imageSourceCanvas.height = 0;
    clearImageOutputCanvas();
    return;
  }

  drawImageSourcePreview(item);
  if (item.outputUrl) {
    drawImageOutputPreview(item);
  } else {
    clearImageOutputCanvas();
  }
}

function drawImageSourcePreview(item) {
  if (!item?.image) {
    els.imageSourceCanvas.width = 0;
    els.imageSourceCanvas.height = 0;
    return;
  }

  const source = getPreparedImageSource(item);
  const { width, height } = getImageNaturalSize(source);
  const scale = Math.min(1, 900 / Math.max(width, height));
  const canvasWidth = Math.max(1, Math.round(width * scale));
  const canvasHeight = Math.max(1, Math.round(height * scale));
  els.imageSourceCanvas.width = canvasWidth;
  els.imageSourceCanvas.height = canvasHeight;

  const context = els.imageSourceCanvas.getContext('2d');
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.drawImage(source, 0, 0, canvasWidth, canvasHeight);

  if (!item.corners?.length) {
    return;
  }

  context.save();
  context.lineWidth = Math.max(3, Math.round(Math.min(canvasWidth, canvasHeight) / 160));
  context.strokeStyle = 'rgba(15, 118, 110, 0.95)';
  context.fillStyle = 'rgba(15, 118, 110, 0.18)';
  const curvePoints = getImageCurvePoints(item);
  context.beginPath();
  context.moveTo(item.corners[0].x * scale, item.corners[0].y * scale);
  for (let index = 0; index < item.corners.length; index += 1) {
    const control = curvePoints[index];
    const end = item.corners[(index + 1) % item.corners.length];
    context.quadraticCurveTo(control.x * scale, control.y * scale, end.x * scale, end.y * scale);
  }
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = '#ffffff';
  context.strokeStyle = 'rgba(15, 118, 110, 0.95)';
  const edgeHandleSize = Math.max(8, context.lineWidth * 2.2);
  context.fillStyle = 'rgba(255, 255, 255, 0.92)';
  context.strokeStyle = 'rgba(15, 118, 110, 0.95)';
  getImageEdgeMidpoints(item.corners).forEach((midpoint) => {
    const x = midpoint.x * scale;
    const y = midpoint.y * scale;
    context.beginPath();
    context.rect(x - edgeHandleSize / 2, y - edgeHandleSize / 2, edgeHandleSize, edgeHandleSize);
    context.fill();
    context.stroke();
  });

  const curveHandleRadius = Math.max(5, context.lineWidth * 1.6);
  context.fillStyle = 'rgba(245, 158, 11, 0.92)';
  context.strokeStyle = '#ffffff';
  curvePoints.forEach((point) => {
    const x = point.x * scale;
    const y = point.y * scale;
    context.beginPath();
    context.moveTo(x, y - curveHandleRadius);
    context.lineTo(x + curveHandleRadius, y);
    context.lineTo(x, y + curveHandleRadius);
    context.lineTo(x - curveHandleRadius, y);
    context.closePath();
    context.fill();
    context.stroke();
  });

  context.fillStyle = '#ffffff';
  context.strokeStyle = 'rgba(15, 118, 110, 0.95)';
  item.corners.forEach((corner, index) => {
    const x = corner.x * scale;
    const y = corner.y * scale;
    context.beginPath();
    context.arc(x, y, Math.max(6, context.lineWidth * 1.8), 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = 'rgba(15, 118, 110, 0.95)';
    context.font = `${Math.max(10, context.lineWidth * 3)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(index + 1), x, y);
    context.fillStyle = '#ffffff';
  });
  context.restore();
}

function drawImageOutputPreview(item) {
  if (!item?.outputUrl) {
    clearImageOutputCanvas();
    return;
  }

  const image = new Image();
  image.onload = () => {
    if (item.id !== state.imageTool.activeId) {
      return;
    }
    els.imageOutputCanvas.width = image.naturalWidth || item.outputWidth || image.width;
    els.imageOutputCanvas.height = image.naturalHeight || item.outputHeight || image.height;
    els.imageOutputCanvas.getContext('2d').drawImage(image, 0, 0);
  };
  image.src = item.outputUrl;
}

function removeImageItem(id) {
  const index = state.imageTool.items.findIndex((item) => item.id === id);
  if (index < 0) return;

  const [item] = state.imageTool.items.splice(index, 1);
  clearImageItemOutput(item, true);
  if (state.imageTool.activeId === id) {
    const nextItem = state.imageTool.items[Math.min(index, state.imageTool.items.length - 1)] || null;
    state.imageTool.activeId = nextItem?.id || null;
  }

  const activeItem = getActiveImageItem();
  state.imageTool.status = activeItem ? getImageItemStatus(activeItem) : 'Ready for an image.';
  drawActiveImagePreviews();
  render();
}

function clearRectifierImages() {
  state.imageTool.items.forEach((item) => clearImageItemOutput(item, true));
  state.imageTool.items = [];
  state.imageTool.activeId = null;
  state.imageTool.draggingHandle = null;
  state.imageTool.status = 'Ready for an image.';
  drawActiveImagePreviews();
  render();
}

async function rotateActiveImage(delta) {
  const item = getActiveImageItem();
  if (!item || state.imageTool.processing) {
    return;
  }

  const oldSource = getPreparedImageSource(item);
  const oldSize = getImageNaturalSize(oldSource);
  const previousCorners = item.corners?.length === 4
    ? item.corners.map((corner) => ({ ...corner }))
    : null;
  const previousCurvePoints = item.curvePoints?.length
    ? item.curvePoints.map((point) => point ? { ...point } : null)
    : null;
  const nextRotation = normalizeRotation((item.rotation || 0) + delta);
  item.rotation = nextRotation;
  clearImageItemOutput(item);

  let shouldDetect = true;
  if (previousCorners) {
    item.corners = rotateImageQuad(previousCorners, delta, oldSize.width, oldSize.height);
    if (previousCurvePoints?.length) {
      item.curvePoints = rotateImageCurvePoints(previousCurvePoints, delta, oldSize.width, oldSize.height);
    }
    const newSource = getPreparedImageSource(item);
    const newSize = getImageNaturalSize(newSource);
    shouldDetect = !validateManualQuad(item.corners, newSize.width, newSize.height);
    if (shouldDetect) {
      item.corners = null;
      item.curvePoints = null;
    }
  }
  state.imageTool.status = previousCorners && !shouldDetect
    ? `${item.fileName} rotated ${item.rotation} deg with selected area preserved.`
    : `${item.fileName} rotated ${item.rotation} deg.`;
  drawActiveImagePreviews();
  render();
  await processImageItem(item, { detect: shouldDetect });
}

function rotateImageQuad(corners, delta, width, height) {
  const rotation = normalizeRotation(delta);
  const rotated = corners.map((corner) => rotateImagePoint(corner, rotation, width, height));

  if (rotation === 90) {
    return [rotated[3], rotated[0], rotated[1], rotated[2]];
  }
  if (rotation === 180) {
    return [rotated[2], rotated[3], rotated[0], rotated[1]];
  }
  if (rotation === 270) {
    return [rotated[1], rotated[2], rotated[3], rotated[0]];
  }
  return rotated;
}

function rotateImageCurvePoints(curvePoints, delta, width, height) {
  const rotation = normalizeRotation(delta);
  const rotated = curvePoints.map((point) => point ? rotateImagePoint(point, rotation, width, height) : null);

  if (rotation === 90) {
    return [rotated[3], rotated[0], rotated[1], rotated[2]];
  }
  if (rotation === 180) {
    return [rotated[2], rotated[3], rotated[0], rotated[1]];
  }
  if (rotation === 270) {
    return [rotated[1], rotated[2], rotated[3], rotated[0]];
  }
  return rotated;
}

function rotateImagePoint(point, rotation, width, height) {
  if (rotation === 90) {
    return {
      x: height - 1 - point.y,
      y: point.x,
    };
  }
  if (rotation === 180) {
    return {
      x: width - 1 - point.x,
      y: height - 1 - point.y,
    };
  }
  if (rotation === 270) {
    return {
      x: point.y,
      y: width - 1 - point.x,
    };
  }
  return { ...point };
}

async function useFullActiveImage() {
  const item = getActiveImageItem();
  if (!item || state.imageTool.processing) {
    return;
  }

  const source = getPreparedImageSource(item);
  const { width, height } = getImageNaturalSize(source);
  item.corners = getFullImageQuad(width, height);
  item.curvePoints = null;
  item.fallback = true;
  state.imageTool.status = `${item.fileName} set to full image.`;
  await processImageItem(item, { detect: false });
}

function getImageCanvasPoint(event, item = getActiveImageItem()) {
  if (!item) {
    return null;
  }

  const rect = els.imageSourceCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }

  const source = getPreparedImageSource(item);
  const { width, height } = getImageNaturalSize(source);
  const canvasX = (event.clientX - rect.left) * (els.imageSourceCanvas.width / rect.width);
  const canvasY = (event.clientY - rect.top) * (els.imageSourceCanvas.height / rect.height);

  return {
    x: clampNumber(canvasX * (width / els.imageSourceCanvas.width), 0, width - 1),
    y: clampNumber(canvasY * (height / els.imageSourceCanvas.height), 0, height - 1),
    width,
    height,
    screenScale: rect.width / width,
  };
}

function getNearestImageCorner(point, corners) {
  if (!point || !corners?.length) {
    return -1;
  }

  const threshold = Math.max(18 / point.screenScale, Math.min(point.width, point.height) * 0.025);
  let bestIndex = -1;
  let bestDistance = Infinity;
  corners.forEach((corner, index) => {
    const distance = distanceBetween(point, corner);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestDistance <= threshold ? bestIndex : -1;
}

function getNearestImageEdge(point, corners) {
  if (!point || !corners?.length) {
    return -1;
  }

  const threshold = Math.max(14 / point.screenScale, Math.min(point.width, point.height) * 0.018);
  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let index = 0; index < corners.length; index += 1) {
    const start = corners[index];
    const end = corners[(index + 1) % corners.length];
    const distance = pointToSegmentDistance(point, start, end);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestDistance <= threshold ? bestIndex : -1;
}

function getNearestImageCurveHandle(point, item) {
  if (!point || !item?.corners?.length) {
    return -1;
  }

  const threshold = Math.max(18 / point.screenScale, Math.min(point.width, point.height) * 0.024);
  const curvePoints = getImageCurvePoints(item);
  let bestIndex = -1;
  let bestDistance = Infinity;
  curvePoints.forEach((curvePoint, index) => {
    const distance = distanceBetween(point, curvePoint);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestDistance <= threshold ? bestIndex : -1;
}

function getImageEdgeMidpoints(corners) {
  return corners.map((corner, index) => {
    const next = corners[(index + 1) % corners.length];
    return {
      x: (corner.x + next.x) / 2,
      y: (corner.y + next.y) / 2,
    };
  });
}

function getImageCurvePoints(item) {
  if (!item?.corners?.length) {
    return [];
  }

  const midpoints = getImageEdgeMidpoints(item.corners);
  if (!item.curvePoints?.length) {
    return midpoints;
  }

  return midpoints.map((midpoint, index) => item.curvePoints[index] || midpoint);
}

function hasActiveCurve(item) {
  if (!item?.curvePoints?.length || !item?.corners?.length) {
    return false;
  }

  const source = getPreparedImageSource(item);
  const { width, height } = getImageNaturalSize(source);
  const tolerance = Math.max(3, Math.min(width, height) * 0.006);
  const midpoints = getImageEdgeMidpoints(item.corners);
  return item.curvePoints.some((point, index) => point && distanceBetween(point, midpoints[index]) > tolerance);
}

function setImageCurvePoint(item, edgeIndex, point) {
  const curvePoints = getImageCurvePoints(item).map((curvePoint) => ({ ...curvePoint }));
  curvePoints[edgeIndex] = { x: point.x, y: point.y };
  item.curvePoints = curvePoints;
}

function normalizeCurvePointsForCorners(curvePoints, corners, width, height) {
  const midpoints = getImageEdgeMidpoints(corners);
  const tolerance = Math.max(3, Math.min(width, height) * 0.006);
  const normalized = midpoints.map((midpoint, index) => {
    const curvePoint = curvePoints[index] || midpoint;
    return distanceBetween(curvePoint, midpoint) > tolerance
      ? {
          x: clampNumber(curvePoint.x, 0, width - 1),
          y: clampNumber(curvePoint.y, 0, height - 1),
        }
      : midpoint;
  });

  return normalized.some((point, index) => distanceBetween(point, midpoints[index]) > tolerance)
    ? normalized
    : null;
}

function getEdgeCornerIndices(edgeIndex) {
  return [edgeIndex, (edgeIndex + 1) % 4];
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) {
    return distanceBetween(point, start);
  }

  const ratio = clampNumber(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return distanceBetween(point, {
    x: start.x + dx * ratio,
    y: start.y + dy * ratio,
  });
}

function startCornerDrag(event) {
  const item = getActiveImageItem();
  if (!item?.corners || state.imageTool.processing) {
    return;
  }

  const point = getImageCanvasPoint(event, item);
  const cornerIndex = getNearestImageCorner(point, item.corners);
  const curveIndex = cornerIndex < 0 ? getNearestImageCurveHandle(point, item) : -1;
  const edgeIndex = cornerIndex < 0 && curveIndex < 0 ? getNearestImageEdge(point, item.corners) : -1;
  if (cornerIndex < 0 && curveIndex < 0 && edgeIndex < 0) {
    return;
  }

  const handleType = cornerIndex >= 0 ? 'corner' : curveIndex >= 0 ? 'curve' : 'edge';
  const handleIndex = cornerIndex >= 0 ? cornerIndex : curveIndex >= 0 ? curveIndex : edgeIndex;

  event.preventDefault();
  els.imageSourceCanvas.setPointerCapture(event.pointerId);
  state.imageTool.draggingHandle = {
    type: handleType,
    itemId: item.id,
    pointerId: event.pointerId,
    handleIndex,
    startPoint: point,
    startCorners: item.corners.map((corner) => ({ ...corner })),
    startCurvePoints: getImageCurvePoints(item).map((curvePoint) => ({ ...curvePoint })),
  };
}

function moveCornerDrag(event) {
  const drag = state.imageTool.draggingHandle;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const item = getActiveImageItem();
  if (!item || item.id !== drag.itemId) {
    return;
  }

  const point = getImageCanvasPoint(event, item);
  if (!point) {
    return;
  }

  const nextCorners = drag.startCorners.map((corner) => ({ ...corner }));
  const nextCurvePoints = drag.startCurvePoints.map((curvePoint) => ({ ...curvePoint }));
  if (drag.type === 'corner') {
    nextCorners[drag.handleIndex] = {
      x: point.x,
      y: point.y,
    };
    const oldMidpoints = getImageEdgeMidpoints(drag.startCorners);
    const newMidpoints = getImageEdgeMidpoints(nextCorners);
    nextCurvePoints.forEach((curvePoint, index) => {
      if (distanceBetween(curvePoint, oldMidpoints[index]) <= Math.max(2, Math.min(point.width, point.height) * 0.006)) {
        nextCurvePoints[index] = newMidpoints[index];
      }
    });
  } else if (drag.type === 'edge') {
    const edgeIndices = getEdgeCornerIndices(drag.handleIndex);
    const movingPoints = edgeIndices.map((index) => nextCorners[index]);
    const delta = clampDeltaForPoints(
      movingPoints,
      point.x - drag.startPoint.x,
      point.y - drag.startPoint.y,
      point.width,
      point.height,
    );
    edgeIndices.forEach((index) => {
      nextCorners[index] = {
        x: drag.startCorners[index].x + delta.x,
        y: drag.startCorners[index].y + delta.y,
      };
    });

    nextCurvePoints[drag.handleIndex] = {
      x: drag.startCurvePoints[drag.handleIndex].x + delta.x,
      y: drag.startCurvePoints[drag.handleIndex].y + delta.y,
    };
  } else if (drag.type === 'curve') {
    nextCurvePoints[drag.handleIndex] = {
      x: point.x,
      y: point.y,
    };
  }

  if (!validateManualQuad(nextCorners, point.width, point.height)) {
    return;
  }

  item.corners = nextCorners;
  item.curvePoints = normalizeCurvePointsForCorners(nextCurvePoints, nextCorners, point.width, point.height);
  item.fallback = false;
  clearImageOutputOnly(item);
  clearImageOutputCanvas();
  state.imageTool.status = `${item.fileName} ${drag.type} adjusted.`;
  drawImageSourcePreview(item);
  render();
}

function finishCornerDrag(event) {
  const drag = state.imageTool.draggingHandle;
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  const item = getActiveImageItem();
  state.imageTool.draggingHandle = null;
  try {
    els.imageSourceCanvas.releasePointerCapture(event.pointerId);
  } catch (error) {
    console.warn('Could not release image corner pointer capture:', error);
  }

  if (item?.id === drag.itemId) {
    processImageItem(item, { detect: false });
  }
}

function clampDeltaForPoints(points, dx, dy, width, height) {
  const bounds = points.reduce((limits, point) => ({
    minDx: Math.max(limits.minDx, -point.x),
    maxDx: Math.min(limits.maxDx, width - 1 - point.x),
    minDy: Math.max(limits.minDy, -point.y),
    maxDy: Math.min(limits.maxDy, height - 1 - point.y),
  }), {
    minDx: -Infinity,
    maxDx: Infinity,
    minDy: -Infinity,
    maxDy: Infinity,
  });

  return {
    x: clampNumber(dx, bounds.minDx, bounds.maxDx),
    y: clampNumber(dy, bounds.minDy, bounds.maxDy),
  };
}

function validateManualQuad(quad, width, height) {
  if (!quad.every((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))) {
    return false;
  }
  if (!quad.every((point) => point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height)) {
    return false;
  }

  const area = polygonArea(quad);
  const sideLengths = [
    distanceBetween(quad[0], quad[1]),
    distanceBetween(quad[1], quad[2]),
    distanceBetween(quad[2], quad[3]),
    distanceBetween(quad[3], quad[0]),
  ];
  return isConvexQuad(quad) && area > 100 && sideLengths.every((length) => length > 8);
}

function waitForFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function detectDocumentCorners(image) {
  const { imageData, scale } = getScaledImageData(image, IMAGE_ANALYSIS_MAX_EDGE);
  const edgePoints = buildEdgePoints(imageData);
  const houghQuad = findDocumentCornersFromHough(edgePoints, imageData.width, imageData.height);
  const extremeQuad = findDocumentCornersFromExtremes(edgePoints, imageData.width, imageData.height);
  const detectedQuad = chooseDocumentQuad(houghQuad, extremeQuad, imageData.width, imageData.height);
  const { width, height } = getImageNaturalSize(image);

  if (!detectedQuad) {
    return {
      corners: getFullImageQuad(width, height),
      fallback: true,
    };
  }

  return {
    corners: scaleQuad(clampQuadToImageBounds(detectedQuad, imageData.width, imageData.height), 1 / scale, 1 / scale),
    fallback: false,
  };
}

function getScaledImageData(image, maxEdge) {
  const { width, height } = getImageNaturalSize(image);
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return {
    imageData: context.getImageData(0, 0, canvas.width, canvas.height),
    scale,
  };
}

function buildEdgePoints(imageData) {
  const { width, height, data } = imageData;
  const gray = new Uint8ClampedArray(width * height);
  const magnitudes = new Uint8ClampedArray(width * height);
  const histogram = new Uint32Array(256);
  const border = Math.max(4, Math.round(Math.min(width, height) * 0.015));

  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    gray[pixel] = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx =
        -gray[index - width - 1] + gray[index - width + 1] -
        gray[index - 1] * 2 + gray[index + 1] * 2 -
        gray[index + width - 1] + gray[index + width + 1];
      const gy =
        -gray[index - width - 1] - gray[index - width] * 2 - gray[index - width + 1] +
        gray[index + width - 1] + gray[index + width] * 2 + gray[index + width + 1];
      const magnitude = Math.min(255, Math.round(Math.hypot(gx, gy) / 4));
      magnitudes[index] = magnitude;
      if (x >= border && x < width - border && y >= border && y < height - border) {
        histogram[magnitude] += 1;
      }
    }
  }

  const threshold = Math.max(18, getHistogramTopThreshold(histogram, 0.16));
  const points = [];
  for (let y = border; y < height - border; y += 1) {
    for (let x = border; x < width - border; x += 1) {
      const index = y * width + x;
      if (magnitudes[index] >= threshold) {
        points.push({ x, y, weight: magnitudes[index] });
      }
    }
  }

  if (points.length <= IMAGE_EDGE_POINT_LIMIT) {
    return points;
  }

  const stride = Math.ceil(points.length / IMAGE_EDGE_POINT_LIMIT);
  return points.filter((_, index) => index % stride === 0).slice(0, IMAGE_EDGE_POINT_LIMIT);
}

function getHistogramTopThreshold(histogram, topRatio) {
  const total = histogram.reduce((sum, count) => sum + count, 0);
  const target = Math.max(1, Math.round(total * topRatio));
  let seen = 0;
  for (let value = histogram.length - 1; value >= 0; value -= 1) {
    seen += histogram[value];
    if (seen >= target) {
      return value;
    }
  }
  return 28;
}

function findDocumentCornersFromHough(points, width, height) {
  if (points.length < 80) {
    return null;
  }

  const thetaCount = 180;
  const rhoStep = Math.max(3, Math.round(Math.max(width, height) / 240));
  const diagonal = Math.hypot(width, height);
  const rhoBins = Math.ceil((diagonal * 2) / rhoStep) + 1;
  const accumulator = new Uint16Array(thetaCount * rhoBins);
  const cosines = [];
  const sines = [];

  for (let theta = 0; theta < thetaCount; theta += 1) {
    const radians = theta * Math.PI / 180;
    cosines[theta] = Math.cos(radians);
    sines[theta] = Math.sin(radians);
  }

  points.forEach((point) => {
    const centeredX = point.x - width / 2;
    const centeredY = point.y - height / 2;
    for (let theta = 0; theta < thetaCount; theta += 1) {
      const rho = centeredX * cosines[theta] + centeredY * sines[theta];
      const rhoIndex = Math.round((rho + diagonal) / rhoStep);
      accumulator[theta * rhoBins + rhoIndex] += 1;
    }
  });

  let maxVotes = 0;
  for (let index = 0; index < accumulator.length; index += 1) {
    if (accumulator[index] > maxVotes) {
      maxVotes = accumulator[index];
    }
  }

  if (maxVotes < 18) {
    return null;
  }

  const minVotes = Math.max(12, Math.round(maxVotes * 0.18));
  const candidates = [];

  for (let theta = 0; theta < thetaCount; theta += 1) {
    const thetaOffset = theta * rhoBins;
    const previousThetaOffset = ((theta + thetaCount - 1) % thetaCount) * rhoBins;
    const nextThetaOffset = ((theta + 1) % thetaCount) * rhoBins;
    for (let rhoIndex = 1; rhoIndex < rhoBins - 1; rhoIndex += 1) {
      const votes = accumulator[thetaOffset + rhoIndex];
      if (votes < minVotes) {
        continue;
      }

      if (
        votes < accumulator[thetaOffset + rhoIndex - 1] ||
        votes < accumulator[thetaOffset + rhoIndex + 1] ||
        votes < accumulator[previousThetaOffset + rhoIndex] ||
        votes < accumulator[nextThetaOffset + rhoIndex]
      ) {
        continue;
      }

      candidates.push({
        theta,
        rho: rhoIndex * rhoStep - diagonal,
        votes,
        cos: cosines[theta],
        sin: sines[theta],
      });
    }
  }

  candidates.sort((a, b) => b.votes - a.votes);
  const lines = [];
  for (const candidate of candidates) {
    const duplicate = lines.some((line) => (
      Math.abs(angleDistance(candidate.theta, line.theta)) < 5 &&
      Math.abs(candidate.rho - line.rho) < rhoStep * 6
    ));
    if (!duplicate) {
      lines.push(candidate);
    }
    if (lines.length >= 140) {
      break;
    }
  }

  return chooseBestHoughQuad(lines, width, height, maxVotes);
}

function angleDistance(a, b) {
  const diff = Math.abs(a - b) % 180;
  return Math.min(diff, 180 - diff);
}

function chooseBestHoughQuad(lines, width, height, maxVotes) {
  const sideCandidates = {
    left: getLineCandidatesForSide(lines, 'left', width, height, maxVotes),
    right: getLineCandidatesForSide(lines, 'right', width, height, maxVotes),
    top: getLineCandidatesForSide(lines, 'top', width, height, maxVotes),
    bottom: getLineCandidatesForSide(lines, 'bottom', width, height, maxVotes),
  };

  if (!sideCandidates.left.length || !sideCandidates.right.length || !sideCandidates.top.length || !sideCandidates.bottom.length) {
    return null;
  }

  let bestQuad = null;
  let bestScore = 0;
  const minWidth = width * 0.18;
  const minHeight = height * 0.18;

  for (const left of sideCandidates.left) {
    for (const right of sideCandidates.right) {
      if (left.coordinate >= right.coordinate - minWidth) {
        continue;
      }

      for (const top of sideCandidates.top) {
        for (const bottom of sideCandidates.bottom) {
          if (top.coordinate >= bottom.coordinate - minHeight) {
            continue;
          }

          const quad = [
            intersectLines(left, top, width, height),
            intersectLines(right, top, width, height),
            intersectLines(right, bottom, width, height),
            intersectLines(left, bottom, width, height),
          ];
          if (!validateQuad(quad, width, height)) {
            continue;
          }

          const score = scoreDocumentQuad(quad, width, height, [left, right, top, bottom]);
          if (score > bestScore) {
            bestScore = score;
            bestQuad = quad;
          }
        }
      }
    }
  }

  return bestQuad;
}

function getLineCandidatesForSide(lines, side, width, height, maxVotes) {
  const isVerticalSide = side === 'left' || side === 'right';
  const size = isVerticalSide ? width : height;
  const candidates = [];

  lines.forEach((line) => {
    const coordinate = getLineCoordinate(line, isVerticalSide, width, height);
    if (!Number.isFinite(coordinate)) {
      return;
    }

    const orientationStrength = isVerticalSide ? Math.abs(line.cos) : Math.abs(line.sin);
    if (orientationStrength < 0.22 || coordinate < -size * 0.22 || coordinate > size * 1.22) {
      return;
    }

    const relative = coordinate / size;
    if ((side === 'left' || side === 'top') && relative > 0.78) {
      return;
    }
    if ((side === 'right' || side === 'bottom') && relative < 0.22) {
      return;
    }

    const outerPosition = side === 'left' || side === 'top'
      ? 1 - clampNumber(relative, 0, 1)
      : clampNumber(relative, 0, 1);
    const preferredZone = side === 'left' || side === 'top'
      ? relative <= 0.35 ? 1.2 : relative <= 0.58 ? 0.85 : 0.42
      : relative >= 0.65 ? 1.2 : relative >= 0.42 ? 0.85 : 0.42;
    const voteRatio = maxVotes ? line.votes / maxVotes : 0;
    const sideScore = (0.3 + Math.sqrt(voteRatio)) *
      (0.45 + orientationStrength) *
      (0.5 + outerPosition * 1.45) *
      preferredZone;

    candidates.push({
      ...line,
      coordinate,
      outerPosition,
      voteRatio,
      sideScore,
    });
  });

  return candidates
    .sort((a, b) => b.sideScore - a.sideScore)
    .slice(0, 18);
}

function scoreDocumentQuad(quad, width, height, lines = []) {
  const areaRatio = polygonArea(quad) / (width * height);
  const bounds = getQuadBounds(quad);
  const coverageX = clampNumber((bounds.maxX - bounds.minX) / width, 0, 1.4);
  const coverageY = clampNumber((bounds.maxY - bounds.minY) / height, 0, 1.4);
  const coverage = clampNumber(coverageX * coverageY, 0, 1.4);
  const outerPosition = lines.length
    ? lines.reduce((sum, line) => sum + (line.outerPosition || 0), 0) / lines.length
    : getQuadOuterPosition(quad, width, height);
  const support = lines.length
    ? lines.reduce((sum, line) => sum + (line.voteRatio || 0), 0) / lines.length
    : 0.35;

  return Math.pow(Math.max(0, areaRatio), 2.5) *
    Math.pow(Math.max(0, coverage), 1.6) *
    (0.72 + outerPosition * 0.85) *
    (0.62 + support * 0.72);
}

function chooseDocumentQuad(houghQuad, extremeQuad, width, height) {
  if (!houghQuad) {
    return extremeQuad;
  }
  if (!extremeQuad) {
    return houghQuad;
  }

  const houghArea = polygonArea(houghQuad);
  const extremeArea = polygonArea(extremeQuad);
  const houghScore = scoreDocumentQuad(houghQuad, width, height);
  const extremeScore = scoreDocumentQuad(extremeQuad, width, height);

  if (extremeArea > houghArea * 1.28 && extremeScore > houghScore * 0.72) {
    return extremeQuad;
  }

  return houghScore >= extremeScore * 0.82 ? houghQuad : extremeQuad;
}

function getQuadBounds(quad) {
  return quad.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });
}

function getQuadOuterPosition(quad, width, height) {
  const bounds = getQuadBounds(quad);
  const leftOuter = 1 - clampNumber(bounds.minX / width, 0, 1);
  const rightOuter = clampNumber(bounds.maxX / width, 0, 1);
  const topOuter = 1 - clampNumber(bounds.minY / height, 0, 1);
  const bottomOuter = clampNumber(bounds.maxY / height, 0, 1);
  return (leftOuter + rightOuter + topOuter + bottomOuter) / 4;
}

function getLineCoordinate(line, verticalSide, width, height) {
  if (verticalSide) {
    return width / 2 + line.rho / line.cos;
  }
  return height / 2 + line.rho / line.sin;
}

function intersectLines(first, second, width, height) {
  const firstC = first.rho + first.cos * width / 2 + first.sin * height / 2;
  const secondC = second.rho + second.cos * width / 2 + second.sin * height / 2;
  const determinant = first.cos * second.sin - second.cos * first.sin;

  if (Math.abs(determinant) < 0.0001) {
    return { x: NaN, y: NaN };
  }

  return {
    x: (firstC * second.sin - secondC * first.sin) / determinant,
    y: (first.cos * secondC - second.cos * firstC) / determinant,
  };
}

function findDocumentCornersFromExtremes(points, width, height) {
  if (points.length < 20) {
    return null;
  }

  const best = {
    topLeft: { score: Infinity, point: null },
    topRight: { score: -Infinity, point: null },
    bottomRight: { score: -Infinity, point: null },
    bottomLeft: { score: -Infinity, point: null },
  };

  points.forEach((point) => {
    const topLeftScore = point.x + point.y;
    const topRightScore = point.x - point.y;
    const bottomRightScore = point.x + point.y;
    const bottomLeftScore = point.y - point.x;

    if (topLeftScore < best.topLeft.score) {
      best.topLeft = { score: topLeftScore, point };
    }
    if (topRightScore > best.topRight.score) {
      best.topRight = { score: topRightScore, point };
    }
    if (bottomRightScore > best.bottomRight.score) {
      best.bottomRight = { score: bottomRightScore, point };
    }
    if (bottomLeftScore > best.bottomLeft.score) {
      best.bottomLeft = { score: bottomLeftScore, point };
    }
  });

  const quad = [best.topLeft.point, best.topRight.point, best.bottomRight.point, best.bottomLeft.point]
    .map((point) => ({ x: point.x, y: point.y }));
  return validateQuad(quad, width, height) ? quad : null;
}

function validateQuad(quad, width, height) {
  if (!quad.every((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))) {
    return false;
  }

  if (!isQuadWithinImageBounds(quad, width, height) || !isConvexQuad(quad)) {
    return false;
  }

  const area = polygonArea(quad);
  const imageArea = width * height;
  const minSide = Math.min(width, height) * 0.08;
  const sideLengths = [
    distanceBetween(quad[0], quad[1]),
    distanceBetween(quad[1], quad[2]),
    distanceBetween(quad[2], quad[3]),
    distanceBetween(quad[3], quad[0]),
  ];

  return area > imageArea * 0.08 &&
    area < imageArea * 1.55 &&
    sideLengths.every((length) => length > minSide);
}

function isQuadWithinImageBounds(quad, width, height) {
  const tolerance = Math.max(2, Math.min(width, height) * 0.006);
  return quad.every((point) => (
    point.x >= -tolerance &&
    point.x <= width - 1 + tolerance &&
    point.y >= -tolerance &&
    point.y <= height - 1 + tolerance
  ));
}

function clampQuadToImageBounds(quad, width, height) {
  return quad.map((point) => ({
    x: clampNumber(point.x, 0, width - 1),
    y: clampNumber(point.y, 0, height - 1),
  }));
}

function isConvexQuad(quad) {
  let sign = 0;
  for (let index = 0; index < quad.length; index += 1) {
    const a = quad[index];
    const b = quad[(index + 1) % quad.length];
    const c = quad[(index + 2) % quad.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 0.0001) {
      return false;
    }
    const currentSign = Math.sign(cross);
    if (sign && currentSign !== sign) {
      return false;
    }
    sign = currentSign;
  }
  return true;
}

function polygonArea(points) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function scaleQuad(quad, scaleX, scaleY) {
  return quad.map((point) => ({
    x: point.x * scaleX,
    y: point.y * scaleY,
  }));
}

function getFullImageQuad(width, height) {
  return [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ];
}

function isFullImageQuad(corners, width, height) {
  const full = getFullImageQuad(width, height);
  const tolerance = Math.max(2, Math.max(width, height) * 0.005);
  return corners?.length === 4 && corners.every((corner, index) => distanceBetween(corner, full[index]) <= tolerance);
}

function warpImageToRectangle(image, corners, curvePoints = null) {
  if (curvePoints?.length) {
    const midpoints = getImageEdgeMidpoints(corners);
    const tolerance = Math.max(3, Math.min(...getImageNaturalSizeArray(image)) * 0.006);
    const hasCurve = curvePoints.some((point, index) => point && distanceBetween(point, midpoints[index]) > tolerance);
    if (hasCurve) {
      return warpCurvedImageToRectangle(image, corners, curvePoints);
    }
  }

  const { width: sourceWidth, height: sourceHeight } = getImageNaturalSize(image);
  const targetWidth = Math.max(distanceBetween(corners[0], corners[1]), distanceBetween(corners[2], corners[3]));
  const targetHeight = Math.max(distanceBetween(corners[0], corners[3]), distanceBetween(corners[1], corners[2]));
  const outputScale = Math.min(1, IMAGE_OUTPUT_MAX_EDGE / Math.max(targetWidth, targetHeight));
  const outputWidth = Math.max(32, Math.round(targetWidth * outputScale));
  const outputHeight = Math.max(32, Math.round(targetHeight * outputScale));
  const sampleScale = Math.min(1, (IMAGE_OUTPUT_MAX_EDGE * 1.25) / Math.max(sourceWidth, sourceHeight));
  const sampleWidth = Math.max(1, Math.round(sourceWidth * sampleScale));
  const sampleHeight = Math.max(1, Math.round(sourceHeight * sampleScale));
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
  sampleContext.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const sourceData = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const imageData = sampleContext.createImageData(outputWidth, outputHeight);
  const outputData = imageData.data;
  const sampleCorners = scaleQuad(corners, sampleScale, sampleScale);
  const matrix = squareToQuadHomography(sampleCorners);

  for (let y = 0; y < outputHeight; y += 1) {
    const v = outputHeight === 1 ? 0 : y / (outputHeight - 1);
    for (let x = 0; x < outputWidth; x += 1) {
      const u = outputWidth === 1 ? 0 : x / (outputWidth - 1);
      const denominator = matrix.g * u + matrix.h * v + 1;
      const sourceX = (matrix.a * u + matrix.b * v + matrix.c) / denominator;
      const sourceY = (matrix.d * u + matrix.e * v + matrix.f) / denominator;
      writeBilinearSample(sourceData, outputData, sampleWidth, sampleHeight, sourceX, sourceY, (y * outputWidth + x) * 4);
    }
  }

  return {
    width: outputWidth,
    height: outputHeight,
    imageData,
  };
}

function getImageNaturalSizeArray(image) {
  const { width, height } = getImageNaturalSize(image);
  return [width, height];
}

function warpCurvedImageToRectangle(image, corners, curvePoints) {
  const { width: sourceWidth, height: sourceHeight } = getImageNaturalSize(image);
  const edgeCurves = buildBoundaryCurves(corners, curvePoints);
  const targetWidth = Math.max(
    polylineLength(edgeCurves.top),
    polylineLength(edgeCurves.bottom),
    distanceBetween(corners[0], corners[1]),
    distanceBetween(corners[2], corners[3]),
  );
  const targetHeight = Math.max(
    polylineLength(edgeCurves.left),
    polylineLength(edgeCurves.right),
    distanceBetween(corners[0], corners[3]),
    distanceBetween(corners[1], corners[2]),
  );
  const outputScale = Math.min(1, IMAGE_OUTPUT_MAX_EDGE / Math.max(targetWidth, targetHeight));
  const outputWidth = Math.max(32, Math.round(targetWidth * outputScale));
  const outputHeight = Math.max(32, Math.round(targetHeight * outputScale));
  const sampleScale = Math.min(1, (IMAGE_OUTPUT_MAX_EDGE * 1.25) / Math.max(sourceWidth, sourceHeight));
  const sampleWidth = Math.max(1, Math.round(sourceWidth * sampleScale));
  const sampleHeight = Math.max(1, Math.round(sourceHeight * sampleScale));
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
  sampleContext.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const scaledCorners = scaleQuad(corners, sampleScale, sampleScale);
  const scaledCurvePoints = scaleQuad(curvePoints, sampleScale, sampleScale);
  const scaledEdgeCurves = buildBoundaryCurves(scaledCorners, scaledCurvePoints);
  const sourceData = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const imageData = sampleContext.createImageData(outputWidth, outputHeight);
  const outputData = imageData.data;

  for (let y = 0; y < outputHeight; y += 1) {
    const v = outputHeight === 1 ? 0 : y / (outputHeight - 1);
    for (let x = 0; x < outputWidth; x += 1) {
      const u = outputWidth === 1 ? 0 : x / (outputWidth - 1);
      const sourcePoint = sampleCurvedPatch(scaledEdgeCurves, u, v);
      writeBilinearSample(sourceData, outputData, sampleWidth, sampleHeight, sourcePoint.x, sourcePoint.y, (y * outputWidth + x) * 4);
    }
  }

  return {
    width: outputWidth,
    height: outputHeight,
    imageData,
  };
}

function buildBoundaryCurves(corners, curvePoints) {
  return {
    top: buildQuadraticCurvePoints(corners[0], curvePoints[0], corners[1]),
    right: buildQuadraticCurvePoints(corners[1], curvePoints[1], corners[2]),
    bottom: buildQuadraticCurvePoints(corners[3], curvePoints[2], corners[2]),
    left: buildQuadraticCurvePoints(corners[0], curvePoints[3], corners[3]),
  };
}

function buildQuadraticCurvePoints(start, control, end, segments = 32) {
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const inverse = 1 - t;
    points.push({
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
    });
  }
  return points;
}

function sampleCurvedPatch(edges, u, v) {
  const top = samplePolyline(edges.top, u);
  const bottom = samplePolyline(edges.bottom, u);
  const left = samplePolyline(edges.left, v);
  const right = samplePolyline(edges.right, v);
  const topLeft = edges.top[0];
  const topRight = edges.top[edges.top.length - 1];
  const bottomLeft = edges.left[edges.left.length - 1];
  const bottomRight = edges.right[edges.right.length - 1];

  const horizontal = lerpPoint(top, bottom, v);
  const vertical = lerpPoint(left, right, u);
  const bilinear = {
    x:
      topLeft.x * (1 - u) * (1 - v) +
      topRight.x * u * (1 - v) +
      bottomLeft.x * (1 - u) * v +
      bottomRight.x * u * v,
    y:
      topLeft.y * (1 - u) * (1 - v) +
      topRight.y * u * (1 - v) +
      bottomLeft.y * (1 - u) * v +
      bottomRight.y * u * v,
  };

  return {
    x: horizontal.x + vertical.x - bilinear.x,
    y: horizontal.y + vertical.y - bilinear.y,
  };
}

function samplePolyline(points, t) {
  if (t <= 0) return points[0];
  if (t >= 1) return points[points.length - 1];

  const lengths = [];
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    total += distanceBetween(points[index], points[index + 1]);
    lengths.push(total);
  }

  const target = total * t;
  const segmentIndex = lengths.findIndex((length) => length >= target);
  const safeIndex = Math.max(0, segmentIndex);
  const previousLength = safeIndex ? lengths[safeIndex - 1] : 0;
  const segmentLength = lengths[safeIndex] - previousLength || 1;
  const localT = (target - previousLength) / segmentLength;
  return lerpPoint(points[safeIndex], points[safeIndex + 1], localT);
}

function polylineLength(points) {
  let length = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    length += distanceBetween(points[index], points[index + 1]);
  }
  return length;
}

function lerpPoint(start, end, t) {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function squareToQuadHomography(quad) {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad;
  const dx1 = topRight.x - bottomRight.x;
  const dy1 = topRight.y - bottomRight.y;
  const dx2 = bottomLeft.x - bottomRight.x;
  const dy2 = bottomLeft.y - bottomRight.y;
  const dx3 = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
  const dy3 = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;

  if (Math.abs(dx3) < 0.0001 && Math.abs(dy3) < 0.0001) {
    return {
      a: topRight.x - topLeft.x,
      b: bottomLeft.x - topLeft.x,
      c: topLeft.x,
      d: topRight.y - topLeft.y,
      e: bottomLeft.y - topLeft.y,
      f: topLeft.y,
      g: 0,
      h: 0,
    };
  }

  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < 0.0001) {
    return {
      a: topRight.x - topLeft.x,
      b: bottomLeft.x - topLeft.x,
      c: topLeft.x,
      d: topRight.y - topLeft.y,
      e: bottomLeft.y - topLeft.y,
      f: topLeft.y,
      g: 0,
      h: 0,
    };
  }

  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;

  return {
    a: topRight.x - topLeft.x + g * topRight.x,
    b: bottomLeft.x - topLeft.x + h * bottomLeft.x,
    c: topLeft.x,
    d: topRight.y - topLeft.y + g * topRight.y,
    e: bottomLeft.y - topLeft.y + h * bottomLeft.y,
    f: topLeft.y,
    g,
    h,
  };
}

function writeBilinearSample(sourceData, outputData, sourceWidth, sourceHeight, sourceX, sourceY, outputIndex) {
  const x = clampNumber(sourceX, 0, sourceWidth - 1);
  const y = clampNumber(sourceY, 0, sourceHeight - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(sourceWidth - 1, x0 + 1);
  const y1 = Math.min(sourceHeight - 1, y0 + 1);
  const xWeight = x - x0;
  const yWeight = y - y0;
  const topLeftIndex = (y0 * sourceWidth + x0) * 4;
  const topRightIndex = (y0 * sourceWidth + x1) * 4;
  const bottomLeftIndex = (y1 * sourceWidth + x0) * 4;
  const bottomRightIndex = (y1 * sourceWidth + x1) * 4;

  for (let channel = 0; channel < 4; channel += 1) {
    const top = sourceData[topLeftIndex + channel] * (1 - xWeight) + sourceData[topRightIndex + channel] * xWeight;
    const bottom = sourceData[bottomLeftIndex + channel] * (1 - xWeight) + sourceData[bottomRightIndex + channel] * xWeight;
    outputData[outputIndex + channel] = Math.round(top * (1 - yWeight) + bottom * yWeight);
  }
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Canvas export failed.'));
    }, type);
  });
}

function downloadRectifiedImage() {
  const item = getActiveImageItem();
  if (!item?.outputUrl) {
    return;
  }

  const link = document.createElement('a');
  link.href = item.outputUrl;
  link.download = item.outputName || 'rectified-image.png';
  document.body.append(link);
  link.click();
  link.remove();
}

async function downloadAllRectifiedImages() {
  const readyItems = state.imageTool.items.filter((item) => item.outputBlob);
  if (!readyItems.length || state.imageTool.processing) {
    return;
  }

  state.imageTool.processing = true;
  state.imageTool.status = `Packaging ${pluralize(readyItems.length, 'image')}...`;
  render();
  await waitForFrame();

  try {
    const files = [];
    const usedNames = new Map();
    for (const item of readyItems) {
      files.push({
        name: getUniqueZipName(item.outputName || buildRectifiedImageName(item.fileName), usedNames),
        bytes: new Uint8Array(await item.outputBlob.arrayBuffer()),
      });
    }

    const zipBytes = buildZipArchive(files);
    const blob = new Blob([zipBytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildRectifiedZipName();
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    state.imageTool.status = `Packaged ${pluralize(files.length, 'image')} into ZIP.`;
  } catch (error) {
    console.error('Could not package rectified images:', error);
    state.imageTool.status = 'Could not package the images.';
  } finally {
    state.imageTool.processing = false;
    render();
  }
}

function getUniqueZipName(name, usedNames) {
  const safeName = name.replace(/[\\/:*?"<>|]+/g, '-');
  const dotIndex = safeName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
  const extension = dotIndex > 0 ? safeName.slice(dotIndex) : '';
  const count = usedNames.get(safeName) || 0;
  usedNames.set(safeName, count + 1);
  return count ? `${baseName}-${count + 1}${extension}` : safeName;
}

function buildRectifiedZipName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
  return `rectified-images-${stamp}.zip`;
}

function buildZipArchive(files) {
  const chunks = [];
  const centralDirectory = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(file.bytes);
    const localHeader = buildZipLocalHeader(nameBytes, file.bytes.length, crc);
    chunks.push(localHeader, file.bytes);
    centralDirectory.push(buildZipCentralDirectoryHeader(nameBytes, file.bytes.length, crc, offset));
    offset += localHeader.length + file.bytes.length;
  });

  const centralDirectoryOffset = offset;
  centralDirectory.forEach((header) => {
    chunks.push(header);
    offset += header.length;
  });

  chunks.push(buildZipEndRecord(files.length, offset - centralDirectoryOffset, centralDirectoryOffset));
  return concatUint8Arrays(chunks);
}

function buildZipLocalHeader(nameBytes, size, crc) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  header.set(nameBytes, 30);
  return header;
}

function buildZipCentralDirectoryHeader(nameBytes, size, crc, offset) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  header.set(nameBytes, 46);
  return header;
}

function buildZipEndRecord(fileCount, centralDirectorySize, centralDirectoryOffset) {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true);
  return record;
}

function concatUint8Arrays(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[index]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
      const addedEntries = await addSourcePagesWithInsertedBlanks(
        merged,
        source,
        sourceIndices,
        item,
        layoutOptions,
        generatedPageSize,
        rotationForSourcePage,
      );

      addedEntries.forEach((entry) => {
        if (entry.role === 'blank') {
          pageInfos.push({ role: 'blank' });
          return;
        }

        pageInfos.push({
          role: 'source',
          sourceItemId: item.id,
          sourceName: item.name,
          sectionIndex: section.index,
          sourcePage: entry.sourceIndex + 1,
        });
      });
    }

    for (let index = 0; index < layoutOptions.blankAfter; index += 1) {
      addUserBlankPage(merged, generatedPageSize);
      pageInfos.push({ role: 'blank' });
    }

    await addWatermark(merged);

    await addSelectedTextStamps(merged, pageInfos);
    await addSelectedImageStamps(merged, pageInfos);

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

  const details = `${pluralize(state.items.length, 'file')} • ${formatSelectionTotal(selectedPagesTotal(), getToolMode())}`;
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

async function addSourcePagesWithInsertedBlanks(pdf, source, sourceIndices, item, layoutOptions, generatedPageSize, getRotation) {
  const entries = [];

  for (let index = 0; index < sourceIndices.length; index += 1) {
    const sourceIndex = sourceIndices[index];
    const pages = layoutOptions.sizeMode === 'original'
      ? await addCopiedSourcePages(pdf, source, [sourceIndex], getRotation)
      : await addFittedSourcePages(pdf, source, [sourceIndex], layoutOptions, getRotation);
    const page = pages[0];
    entries.push({ role: 'source', page, sourceIndex });

    if (item.blankAfterPages?.has(sourceIndex)) {
      const blankPage = addBlankPageLike(pdf, page, generatedPageSize);
      entries.push({ role: 'blank', page: blankPage });
    }
  }

  return entries;
}

function addBlankPageLike(pdf, referencePage, fallbackSize = COVER_PAGE_SIZE) {
  const page = pdf.addPage();
  if (referencePage) {
    const { width, height } = referencePage.getSize();
    page.setSize(width, height);
    page.setRotation(referencePage.getRotation());
    return page;
  }

  page.setSize(fallbackSize[0], fallbackSize[1]);
  return page;
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

async function addSelectedTextStamps(pdf, pageInfos = []) {
  const options = getTextStampOptions();
  if (!options.enabled || !options.text) {
    return;
  }

  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  pages.forEach((page, index) => {
    const info = pageInfos[index];
    if (!shouldApplySelectedPageEdit(info)) {
      return;
    }

    const displaySize = getDisplaySize(page);
    const label = truncateText(font, options.text, options.size, displaySize.width - 48);
    const placement = getDisplayBoxPlacement(page, font.widthOfTextAtSize(label, options.size), options.size, options.position, 24);
    page.drawText(label, {
      x: placement.x,
      y: placement.y,
      size: options.size,
      font,
      color: rgb(0.12, 0.17, 0.25),
      opacity: 0.88,
      rotate: placement.rotate,
    });
  });
}

async function addSelectedImageStamps(pdf, pageInfos = []) {
  const options = getImageStampOptions();
  if (!options.enabled || !options.image?.bytes) {
    return;
  }

  const image = options.image.type === 'image/png'
    ? await pdf.embedPng(options.image.bytes)
    : await pdf.embedJpg(options.image.bytes);
  const pages = pdf.getPages();

  pages.forEach((page, index) => {
    const info = pageInfos[index];
    if (!shouldApplySelectedPageEdit(info)) {
      return;
    }

    const displaySize = getDisplaySize(page);
    const maxWidth = displaySize.width * (options.widthPercent / 100);
    const scale = maxWidth / image.width;
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const placement = getDisplayBoxPlacement(page, drawWidth, drawHeight, options.position, 24);

    page.drawImage(image, {
      x: placement.x,
      y: placement.y,
      width: drawWidth,
      height: drawHeight,
      opacity: 0.92,
      rotate: placement.rotate,
    });
  });
}

function shouldApplySelectedPageEdit(info) {
  if (info?.role !== 'source') {
    return false;
  }

  const item = state.items.find((entry) => entry.id === info.sourceItemId);
  if (!item || typeof item.pages !== 'number') {
    return false;
  }

  const selection = resolveTileSelection(item);
  return selection.ok && selection.set.has(info.sourcePage - 1);
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
  const textWidth = font.widthOfTextAtSize(label, size);
  return getDisplayBoxPlacement(page, textWidth, size, placement, margin);
}

function getDisplayBoxPlacement(page, boxWidth, boxHeight, position, margin) {
  const placement = position || 'bottom-center';
  const rotation = normalizeRotation(page.getRotation().angle);
  const { width, height } = page.getSize();
  const displaySize = getDisplaySize(page);
  const alignLeft = placement.endsWith('left');
  const alignRight = placement.endsWith('right');
  const alignTop = placement.startsWith('top');
  const alignBottom = placement.startsWith('bottom');
  const centeredX = (displaySize.width - boxWidth) / 2;
  const centeredY = (displaySize.height - boxHeight) / 2;
  const rightX = displaySize.width - margin - boxWidth;
  const topY = displaySize.height - margin - boxHeight;
  const displayX = Math.max(margin, alignLeft ? margin : alignRight ? rightX : centeredX);
  const displayY = Math.max(margin, alignTop ? topY : alignBottom ? margin : centeredY);
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

function openImageFilePicker() {
  if (!state.imageTool.processing) {
    els.imageInput.click();
  }
}

els.addButton.addEventListener('click', openFilePicker);
els.dropzone.addEventListener('click', openFilePicker);
els.fileInput.addEventListener('change', (event) => {
  addFiles(event.target.files);
  event.target.value = '';
});
els.imageChooseButton.addEventListener('click', openImageFilePicker);
els.imageDropzone.addEventListener('click', openImageFilePicker);
els.imageInput.addEventListener('change', (event) => {
  addRectifierImages(event.target.files);
  event.target.value = '';
});
els.imageAutoButton.addEventListener('click', processRectifierImage);
els.imageRotateLeftButton.addEventListener('click', () => rotateActiveImage(-90));
els.imageRotateRightButton.addEventListener('click', () => rotateActiveImage(90));
els.imageResetCornersButton.addEventListener('click', useFullActiveImage);
els.imageClearButton.addEventListener('click', clearRectifierImages);
els.imageDownloadButton.addEventListener('click', downloadRectifiedImage);
els.imageDownloadAllButton.addEventListener('click', downloadAllRectifiedImages);
els.imageSourceCanvas.addEventListener('pointerdown', startCornerDrag);
els.imageSourceCanvas.addEventListener('pointermove', moveCornerDrag);
els.imageSourceCanvas.addEventListener('pointerup', finishCornerDrag);
els.imageSourceCanvas.addEventListener('pointercancel', finishCornerDrag);
els.clearButton.addEventListener('click', clearQueue);
els.previewButton.addEventListener('click', previewCombination);
els.selectAllPages.addEventListener('click', () => selectActivePages('all'));
els.selectNoPages.addEventListener('click', () => selectActivePages('none'));
els.invertPageSelection.addEventListener('click', () => selectActivePages('invert'));
els.insertBlankAfterPages.addEventListener('click', insertBlankAfterSelectedPages);
els.clearInsertedBlanks.addEventListener('click', clearInsertedBlanks);
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
els.stampTextEnabled.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.stampText.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.stampTextPosition.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.stampTextSize.addEventListener('input', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.stampImageEnabled.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.stampImageButton.addEventListener('click', () => {
  if (!state.busy) {
    els.stampImageFile.click();
  }
});
els.stampImageFile.addEventListener('change', (event) => {
  updateStampImage(event.target.files?.[0]);
  event.target.value = '';
});
els.stampImagePosition.addEventListener('change', () => {
  clearOutput();
  state.notice = '';
  render();
});
els.stampImageSize.addEventListener('input', () => {
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
  els.imageDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!state.imageTool.processing) {
      els.imageDropzone.classList.add('is-dragging');
    }
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  els.imageDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    els.imageDropzone.classList.remove('is-dragging');
  });
});

els.imageDropzone.addEventListener('drop', (event) => {
  if (state.imageTool.processing) return;
  const files = [...(event.dataTransfer?.files || [])];
  const imageFiles = files.filter(isImageFile);
  if (imageFiles.length) {
    addRectifierImages(imageFiles);
    return;
  }

  state.imageTool.status = 'Drop a JPG, PNG, or WebP image.';
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
