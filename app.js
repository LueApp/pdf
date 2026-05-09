const { PDFDocument } = PDFLib;

const els = {
  addButton: document.getElementById('add-btn'),
  clearButton: document.getElementById('clear-btn'),
  dropzone: document.getElementById('dropzone'),
  dropHint: document.getElementById('drop-hint'),
  emptyState: document.getElementById('empty-state'),
  fileInput: document.getElementById('file-input'),
  fileList: document.getElementById('file-list'),
  output: document.getElementById('output'),
  previewButton: document.getElementById('preview-btn'),
  previewFrame: document.getElementById('preview-frame'),
  previewPlaceholder: document.getElementById('preview-placeholder'),
  previewNote: document.getElementById('preview-note'),
  queueNote: document.getElementById('queue-note'),
  status: document.getElementById('status'),
  summary: document.getElementById('summary'),
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
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
  return `merged-${stamp}.pdf`;
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
  els.output.textContent = 'No preview generated yet.';
}

function totalPages() {
  return state.items.reduce((sum, item) => sum + (typeof item.pages === 'number' ? item.pages : 0), 0);
}

function hasErrors() {
  return state.items.some((item) => item.error);
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

  if (countPending()) {
    els.summary.textContent = `${pluralize(count, 'file')} • reading...`;
    return;
  }

  els.summary.textContent = `${pluralize(count, 'file')} • ${pluralize(totalPages(), 'page')}`;
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

  if (countPending()) {
    els.status.textContent = 'Reading file details...';
    return;
  }

  if (state.notice) {
    els.status.textContent = state.notice;
    return;
  }

  els.status.textContent = state.items.length ? 'Ready to preview.' : 'Ready.';
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
  link.textContent = 'Download merged PDF';

  els.output.append(text, document.createElement('br'), link);
}

function renderPreview() {
  if (!state.downloadUrl) {
    els.previewPlaceholder.hidden = false;
    els.previewFrame.hidden = true;
    els.previewNote.textContent = 'Create a preview to inspect the merged PDF before downloading.';
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
    els.queueNote.textContent = 'Add PDF files to arrange the merge order.';
    els.dropHint.textContent = 'No files selected.';
    return;
  }

  const pages = countPending() ? 'reading details' : pluralize(totalPages(), 'page');
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

function renderControls() {
  const disabled = state.busy;
  els.addButton.disabled = disabled;
  els.clearButton.disabled = disabled || state.items.length === 0;
  els.previewButton.disabled = disabled || state.items.length === 0 || hasErrors() || countPending() > 0;
  els.previewButton.textContent = state.busy ? 'Creating preview...' : 'Preview combination';
  els.dropzone.disabled = disabled;
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

  state.busy = true;
  render();

  try {
    const merged = await PDFDocument.create();

    for (const item of state.items) {
      const bytes = await item.file.arrayBuffer();
      const source = await PDFDocument.load(bytes);
      const pageIndices = Array.from({ length: source.getPageCount() }, (_, index) => index);
      const pages = await merged.copyPages(source, pageIndices);
      pages.forEach((page) => merged.addPage(page));
    }

    const mergedBytes = await merged.save();
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    if (state.downloadUrl) {
      URL.revokeObjectURL(state.downloadUrl);
    }

    state.downloadUrl = url;
    state.outputName = buildOutputName();
    state.notice = `Preview ready: ${pluralize(state.items.length, 'PDF')} combined into ${pluralize(merged.getPageCount(), 'page')}.`;
    state.outputSummary = `${state.outputName} • ${pluralize(merged.getPageCount(), 'page')} • ${formatBytes(blob.size)}`;
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
