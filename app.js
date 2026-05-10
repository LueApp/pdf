const { PDFDocument, StandardFonts, degrees, rgb } = PDFLib;
const COVER_PAGE_SIZE = [595.28, 841.89];

const els = {
  addButton: document.getElementById('add-btn'),
  clearButton: document.getElementById('clear-btn'),
  coverOptions: document.getElementById('cover-options'),
  coverPage: document.getElementById('cover-page'),
  coverSubtitle: document.getElementById('cover-subtitle'),
  coverTitle: document.getElementById('cover-title'),
  dropzone: document.getElementById('dropzone'),
  dropHint: document.getElementById('drop-hint'),
  emptyState: document.getElementById('empty-state'),
  fileInput: document.getElementById('file-input'),
  fileList: document.getElementById('file-list'),
  metadataAuthor: document.getElementById('metadata-author'),
  metadataSubject: document.getElementById('metadata-subject'),
  metadataTitle: document.getElementById('metadata-title'),
  output: document.getElementById('output'),
  outputName: document.getElementById('output-name'),
  pageNumberFormat: document.getElementById('page-number-format'),
  pageNumberOptions: document.getElementById('page-number-options'),
  pageNumberPosition: document.getElementById('page-number-position'),
  pageNumberStart: document.getElementById('page-number-start'),
  pageNumbers: document.getElementById('page-numbers'),
  previewButton: document.getElementById('preview-btn'),
  previewFrame: document.getElementById('preview-frame'),
  previewPlaceholder: document.getElementById('preview-placeholder'),
  previewNote: document.getElementById('preview-note'),
  queueNote: document.getElementById('queue-note'),
  separatorPages: document.getElementById('separator-pages'),
  status: document.getElementById('status'),
  summary: document.getElementById('summary'),
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

function getCoverOptions() {
  const outputName = stripPdfExtension(buildOutputName());
  return {
    enabled: els.coverPage.checked,
    title: cleanTextInput(els.coverTitle.value) || outputName || 'Merged PDF',
    subtitle: cleanTextInput(els.coverSubtitle.value),
  };
}

function getMetadataOptions() {
  return {
    title: cleanTextInput(els.metadataTitle.value),
    author: cleanTextInput(els.metadataAuthor.value),
    subject: cleanTextInput(els.metadataSubject.value),
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
  if (els.coverPage.checked) {
    labels.push('cover page');
  }
  if (els.separatorPages.checked && state.items.length > 1) {
    labels.push('separator pages');
  }
  if (els.pageNumbers.checked) {
    labels.push('page numbers');
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
  els.previewFrame.src = 'about:blank';
  els.previewFrame.hidden = true;
  els.previewPlaceholder.hidden = false;
  els.output.textContent = 'No preview generated yet.';
}

function totalPages() {
  return state.items.reduce((sum, item) => sum + (typeof item.pages === 'number' ? item.pages : 0), 0);
}

function selectedPagesTotal() {
  return state.items.reduce((sum, item) => {
    if (typeof item.pages !== 'number' || item.error) {
      return sum;
    }

    const selection = parsePageRanges(item.range, item.pages);
    return selection.ok ? sum + selection.indices.length : sum;
  }, 0);
}

function hasErrors() {
  return state.items.some((item) => item.error);
}

function hasRangeErrors() {
  return state.items.some((item) => typeof item.pages === 'number' && !parsePageRanges(item.range, item.pages).ok);
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

  els.summary.textContent = `${pluralize(count, 'file')} • ${pluralize(selectedPagesTotal(), 'selected page')}`;
}

function renderStatus() {
  if (state.busy) {
    els.status.textContent = 'Creating preview...';
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

  els.status.textContent = state.items.length ? 'Ready to preview modifications.' : 'Ready.';
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
  if (!state.downloadUrl) {
    els.previewPlaceholder.hidden = false;
    els.previewFrame.hidden = true;
    els.previewNote.textContent = 'Create a preview to inspect the modified PDF before downloading.';
    return;
  }

  els.previewPlaceholder.hidden = true;
  els.previewFrame.hidden = false;
  if (els.previewFrame.src !== state.downloadUrl) {
    els.previewFrame.src = state.downloadUrl;
  }
  els.previewNote.textContent = state.outputSummary || 'Preview is ready for inspection.';
}

function renderQueueNote() {
  if (!state.items.length) {
    els.queueNote.textContent = 'Add PDF files, choose pages, and adjust rotation.';
    els.dropHint.textContent = 'No files selected.';
    return;
  }

  const pages = countPending() ? 'reading details' : `${pluralize(selectedPagesTotal(), 'selected page')} from ${pluralize(totalPages(), 'source page')}`;
  els.queueNote.textContent = `${pluralize(state.items.length, 'file')} queued • ${pages}`;
  els.dropHint.textContent = `${pluralize(state.items.length, 'file')} queued.`;
}

function renderList() {
  els.fileList.innerHTML = '';
  els.emptyState.hidden = state.items.length > 0;

  state.items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'file-item';

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

    actions.append(up, down, remove);
    li.append(main, actions);
    els.fileList.append(li);
  });
}

function buildFileOptions(item) {
  const options = document.createElement('div');
  options.className = 'file-options';

  const selection = parsePageRanges(item.range, item.pages);

  const rangeField = document.createElement('label');
  rangeField.className = 'range-field';

  const rangeLabel = document.createElement('span');
  rangeLabel.textContent = 'Pages';

  const rangeInput = document.createElement('input');
  rangeInput.type = 'text';
  rangeInput.value = item.range;
  rangeInput.placeholder = `All 1-${item.pages}`;
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
  helper.textContent = selection.ok
    ? `${pluralize(selection.indices.length, 'selected page')}`
    : selection.error;

  const rotateGroup = document.createElement('div');
  rotateGroup.className = 'rotate-group';
  rotateGroup.setAttribute('aria-label', `Rotation for ${item.name}`);

  const rotateLabel = document.createElement('span');
  rotateLabel.textContent = 'Rotate';

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
  reverseLabel.textContent = 'Reverse selected page order';

  reverseField.append(reverseInput, reverseLabel);

  options.append(rangeField, rotateGroup, reverseField, helper);
  return options;
}

function renderControls() {
  const disabled = state.busy;
  els.addButton.disabled = disabled;
  els.clearButton.disabled = disabled || state.items.length === 0;
  els.previewButton.disabled = disabled || state.items.length === 0 || hasErrors() || hasRangeErrors() || countPending() > 0;
  els.previewButton.textContent = state.busy ? 'Creating preview...' : 'Preview combination';
  els.dropzone.disabled = disabled;
  els.outputName.disabled = disabled;
  els.coverPage.disabled = disabled;
  els.coverTitle.disabled = disabled || !els.coverPage.checked;
  els.coverSubtitle.disabled = disabled || !els.coverPage.checked;
  els.coverOptions.classList.toggle('is-disabled', disabled || !els.coverPage.checked);
  els.separatorPages.disabled = disabled || state.items.length < 2;
  els.pageNumbers.disabled = disabled;
  els.pageNumberFormat.disabled = disabled || !els.pageNumbers.checked;
  els.pageNumberPosition.disabled = disabled || !els.pageNumbers.checked;
  els.pageNumberStart.disabled = disabled || !els.pageNumbers.checked;
  els.pageNumberOptions.classList.toggle('is-disabled', disabled || !els.pageNumbers.checked);
  els.metadataTitle.disabled = disabled;
  els.metadataAuthor.disabled = disabled;
  els.metadataSubject.disabled = disabled;
  els.watermarkText.disabled = disabled;
  els.watermarkAngle.disabled = disabled;
  els.watermarkOpacity.disabled = disabled;
  els.watermarkSize.disabled = disabled;
  els.watermarkOpacityValue.textContent = `${els.watermarkOpacity.value}%`;
  els.watermarkSizeValue.textContent = `${els.watermarkSize.value} pt`;
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
      pages: null,
      error: null,
      range: '',
      reverse: false,
      rotation: 0,
    };

    state.items.push(item);
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

  state.items.splice(index, 1);
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
  state.items = [];
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
    const merged = await PDFDocument.create();
    applyMetadata(merged);

    const coverOptions = getCoverOptions();
    if (coverOptions.enabled) {
      await addCoverPage(merged, coverOptions);
    }

    for (const [index, item] of state.items.entries()) {
      const bytes = await item.file.arrayBuffer();
      const source = await PDFDocument.load(bytes);
      const selection = parsePageRanges(item.range, source.getPageCount());

      if (!selection.ok) {
        throw new Error(`${item.name}: ${selection.error}`);
      }

      if (els.separatorPages.checked && index > 0) {
        await addSeparatorPage(merged, item, index + 1, selection.indices.length);
      }

      const sourceIndices = item.reverse ? [...selection.indices].reverse() : selection.indices;
      const pages = await merged.copyPages(source, sourceIndices);
      pages.forEach((page) => {
        if (item.rotation) {
          const currentRotation = page.getRotation().angle;
          page.setRotation(degrees((currentRotation + item.rotation) % 360));
        }
        merged.addPage(page);
      });
    }

    await addWatermark(merged);

    if (els.pageNumbers.checked) {
      await addPageNumbers(merged);
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
    state.notice = `Preview ready: ${pluralize(state.items.length, 'PDF')} modified into ${pluralize(merged.getPageCount(), 'page')}.`;
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

async function addCoverPage(pdf, options) {
  const page = pdf.addPage();
  page.setSize(COVER_PAGE_SIZE[0], COVER_PAGE_SIZE[1]);
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

async function addSeparatorPage(pdf, item, sectionNumber, selectedCount) {
  const page = pdf.addPage();
  page.setSize(COVER_PAGE_SIZE[0], COVER_PAGE_SIZE[1]);
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

async function addPageNumbers(pdf) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const total = pages.length;
  const options = getPageNumberOptions();

  pages.forEach((page, index) => {
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
  const margin = 18;
  const placement = position || 'bottom-center';
  const rotation = normalizeRotation(page.getRotation().angle);
  const { width, height } = page.getSize();
  const displaySize = getDisplaySize(page);
  const textWidth = font.widthOfTextAtSize(label, size);
  const alignRight = placement.endsWith('right');
  const alignTop = placement.startsWith('top');
  const centeredX = (displaySize.width - textWidth) / 2;
  const rightX = displaySize.width - margin - textWidth;
  const topY = displaySize.height - margin - size;
  const displayX = Math.max(margin, alignRight ? rightX : centeredX);
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
els.pageNumberStart.addEventListener('input', () => {
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
