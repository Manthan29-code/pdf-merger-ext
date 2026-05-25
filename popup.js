// popup.js - popup coordinator, in-memory only

let allPdfs = [];
let selected = new Set();
let order = [];

const pdfList = document.getElementById('pdfList');
const emptyState = document.getElementById('emptyState');
const toolbar = document.getElementById('toolbar');
const selCount = document.getElementById('selCount');
const mergeBtn = document.getElementById('mergeBtn');
const refreshBtn = document.getElementById('refreshBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');
const footerHint = document.getElementById('footerHint');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const toastEl = document.getElementById('toast');
const compressToggle = document.getElementById('compressToggle');
const qualitySlider = document.getElementById('qualitySlider');
const qualityValue = document.getElementById('qualityValue');

let toastTimer;
let dragSrcId = null;

CompressMerge.bind({
  checkbox: compressToggle,
  slider: qualitySlider,
  value: qualityValue
});

function toast(msg, isError = false) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className = `toast show${isError ? ' error' : ''}`;
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 2800);
}

function setProgress(pct) {
  if (pct === null) {
    progressWrap.classList.remove('visible');
    progressBar.style.width = '0%';
    return;
  }

  progressWrap.classList.add('visible');
  progressBar.style.width = `${pct}%`;
}

function loadPdfs() {
  refreshBtn.style.opacity = '0.4';
  chrome.runtime.sendMessage({ type: 'GET_PDF_TABS' }, (res) => {
    refreshBtn.style.opacity = '';
    if (chrome.runtime.lastError || !res) {
      toast('Could not reach background service', true);
      return;
    }

    const incoming = res.pdfs || [];
    const incomingIds = new Set(incoming.map(pdf => pdf.tabId));
    const newOrder = order.filter(id => incomingIds.has(id));

    for (const pdf of incoming) {
      if (!newOrder.includes(pdf.tabId)) newOrder.push(pdf.tabId);
    }

    for (const id of selected) {
      if (!incomingIds.has(id)) selected.delete(id);
    }
    PageRanges.prune(incomingIds);

    allPdfs = incoming;
    order = newOrder;
    render();
  });
}

function render() {
  const hasPdfs = allPdfs.length > 0;
  emptyState.style.display = hasPdfs ? 'none' : 'flex';
  toolbar.style.display = hasPdfs ? 'flex' : 'none';
  pdfList.innerHTML = '';

  const map = Object.fromEntries(allPdfs.map(pdf => [pdf.tabId, pdf]));
  order.forEach((tabId, index) => {
    const pdf = map[tabId];
    if (!pdf) return;
    pdfList.appendChild(buildItem(pdf, index + 1, selected.has(tabId)));
  });

  updateCounts();
  attachDragEvents();
}

function buildItem(pdf, num, isChecked) {
  const item = document.createElement('div');
  item.className = `pdf-item${isChecked ? ' selected' : ''}`;
  item.dataset.id = pdf.tabId;

  const shortUrl = getShortUrl(pdf.url);
  item.innerHTML = `
    <div class="drag-handle" draggable="true" title="Drag to reorder">
      <svg viewBox="0 0 12 12" fill="currentColor">
        <circle cx="3.5" cy="2.5" r="1"/><circle cx="8.5" cy="2.5" r="1"/>
        <circle cx="3.5" cy="6" r="1"/><circle cx="8.5" cy="6" r="1"/>
        <circle cx="3.5" cy="9.5" r="1"/><circle cx="8.5" cy="9.5" r="1"/>
      </svg>
    </div>
    <div class="check-wrap">
      <div class="check ${isChecked ? 'checked' : ''}" data-id="${pdf.tabId}" title="Include in merge">
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="1.5,5 4,7.5 8.5,2"/>
        </svg>
      </div>
    </div>
    <div class="pdf-icon">
      <svg viewBox="0 0 30 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="28" height="34" rx="3" fill="#EDF1F7" stroke="#2B3A55" stroke-width="1.2"/>
        <path d="M18 1v8h9" fill="none" stroke="#2B3A55" stroke-width="1.2"/>
        <rect x="3" y="20" width="24" height="10" rx="2" fill="#D4845A"/>
        <text x="15" y="28.5" text-anchor="middle" font-family="DM Mono,monospace" font-size="7" font-weight="600" fill="#F7F4EF">PDF</text>
        <line x1="5" y1="13" x2="20" y2="13" stroke="#2B3A55" stroke-width="1" stroke-linecap="round" opacity="0.4"/>
        <line x1="5" y1="16" x2="16" y2="16" stroke="#2B3A55" stroke-width="1" stroke-linecap="round" opacity="0.4"/>
      </svg>
    </div>
    <div class="pdf-info">
      <div class="pdf-title" data-tabid="${pdf.tabId}" title="${escHtml(pdf.title)}">${escHtml(truncate(pdf.title, 42))}</div>
      <div class="pdf-url">${escHtml(shortUrl)}</div>
    </div>
    <div class="order-num">${num}</div>
    <div class="pdf-controls">
      <input class="range-input" data-id="${pdf.tabId}" value="${escHtml(PageRanges.get(pdf.tabId))}" placeholder="pages: all, 1-3, 5" title="Pages to include when merging or splitting">
      <button class="split-btn" data-id="${pdf.tabId}" title="Extract this range into a new PDF">Split</button>
    </div>
  `;

  item.querySelector('.check').addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSelect(pdf.tabId);
  });

  item.querySelector('.pdf-title').addEventListener('click', (event) => {
    event.stopPropagation();
    chrome.runtime.sendMessage({ type: 'FOCUS_TAB', tabId: pdf.tabId });
  });

  item.querySelector('.range-input').addEventListener('click', event => event.stopPropagation());
  item.querySelector('.range-input').addEventListener('input', (event) => {
    PageRanges.set(pdf.tabId, event.target.value);
    updateCounts();
  });

  item.querySelector('.split-btn').addEventListener('click', async (event) => {
    event.stopPropagation();
    await splitOnePdf(pdf);
  });

  item.addEventListener('click', (event) => {
    if (event.target.closest('.drag-handle, .pdf-title, .range-input, .split-btn')) return;
    toggleSelect(pdf.tabId);
  });

  return item;
}

function toggleSelect(tabId) {
  if (selected.has(tabId)) selected.delete(tabId);
  else selected.add(tabId);
  render();
}

function updateCounts() {
  const total = allPdfs.length;
  const sel = selected.size;
  selCount.textContent = `${sel} / ${total}`;

  const enabled = sel >= 2;
  mergeBtn.disabled = !enabled;
  footerHint.textContent = sel === 0
    ? 'Select PDFs above to merge them'
    : sel === 1
      ? 'Select at least one more PDF'
      : `${sel} PDFs selected - ${CompressMerge.hint()}`;
}

selectAllBtn.addEventListener('click', () => {
  allPdfs.forEach(pdf => selected.add(pdf.tabId));
  render();
});

deselectAllBtn.addEventListener('click', () => {
  selected.clear();
  render();
});

function attachDragEvents() {
  const items = pdfList.querySelectorAll('.pdf-item');
  items.forEach(item => {
    const handle = item.querySelector('.drag-handle');

    handle.addEventListener('dragstart', (event) => {
      dragSrcId = Number(item.dataset.id);
      event.dataTransfer.effectAllowed = 'move';
      setTimeout(() => item.classList.add('dragging'), 0);
    });

    handle.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      pdfList.querySelectorAll('.pdf-item').forEach(row => row.classList.remove('drag-over'));
      dragSrcId = null;
    });

    item.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (Number(item.dataset.id) !== dragSrcId) {
        pdfList.querySelectorAll('.pdf-item').forEach(row => row.classList.remove('drag-over'));
        item.classList.add('drag-over');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (event) => {
      event.preventDefault();
      item.classList.remove('drag-over');
      const targetId = Number(item.dataset.id);
      if (dragSrcId === null || dragSrcId === targetId) return;

      const srcIdx = order.indexOf(dragSrcId);
      const tgtIdx = order.indexOf(targetId);
      if (srcIdx === -1 || tgtIdx === -1) return;

      order.splice(srcIdx, 1);
      order.splice(tgtIdx, 0, dragSrcId);
      render();
    });
  });
}

mergeBtn.addEventListener('click', mergeSelectedPdfs);
refreshBtn.addEventListener('click', loadPdfs);
compressToggle.addEventListener('change', updateCounts);
qualitySlider.addEventListener('input', updateCounts);

async function mergeSelectedPdfs() {
  const map = Object.fromEntries(allPdfs.map(pdf => [pdf.tabId, pdf]));
  const toMerge = order.filter(id => selected.has(id)).map(id => map[id]).filter(Boolean);

  if (toMerge.length < 2) {
    toast('Please select at least 2 PDFs', true);
    return;
  }

  setBusy(true, 'Merging...');
  setProgress(5);

  try {
    const { PDFDocument } = PDFLib;
    const merged = await PDFDocument.create();
    let totalPages = 0;
    const mergedPdfs = [];
    const skippedPdfs = [];

    for (let index = 0; index < toMerge.length; index += 1) {
      const pdf = toMerge[index];
      setProgress(5 + Math.round((index / toMerge.length) * 82));

      try {
        const bytes = await fetchPdfBytes(pdf);
        const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pageIndices = PageRanges.parse(PageRanges.get(pdf.tabId), srcDoc.getPageCount());
        const pages = await merged.copyPages(srcDoc, pageIndices);
        pages.forEach(page => merged.addPage(page));
        totalPages += pageIndices.length;
        mergedPdfs.push(pdf);
      } catch (err) {
        console.warn('Skipping inaccessible PDF:', pdf.title, err);
        skippedPdfs.push({ pdf, err });
      }
    }

    if (mergedPdfs.length < 2) {
      const skippedNames = formatSkippedPdfNames(skippedPdfs);
      throw new Error(skippedNames
        ? `Need at least 2 accessible PDFs. Edge blocked: ${skippedNames}`
        : 'Need at least 2 accessible PDFs.');
    }

    setProgress(92);
    const outBytes = await CompressMerge.save(merged);
    savePdfBytes(outBytes, `merged-${mergedPdfs.length}-pdfs.pdf`);
    setProgress(100);
    toast(buildMergeResultMessage(totalPages, mergedPdfs.length, skippedPdfs));
    setTimeout(() => setProgress(null), 1000);
  } catch (err) {
    console.error('Merge error:', err);
    toast(err.message || 'Merge failed - check console for details', true);
    setProgress(null);
  } finally {
    setBusy(false);
  }
}

async function splitOnePdf(pdf) {
  setBusy(true, 'Splitting...');
  setProgress(5);

  try {
    await SplitPdfFeature.split(pdf, PageRanges.get(pdf.tabId), {
      fetchPdfBytes,
      savePdfBytes,
      setProgress,
      toast,
      truncate
    });
    setTimeout(() => setProgress(null), 1000);
  } catch (err) {
    console.error('Split error:', err);
    toast(err.message || 'Split failed - check console for details', true);
    setProgress(null);
  } finally {
    setBusy(false);
  }
}

async function fetchPdfBytes(pdf) {
  const errors = [];
  const isLocalFile = isFileUrl(pdf.url);
  const strategies = isLocalFile
    ? [fetchPdfBytesFromUrl, fetchPdfBytesFromTab]
    : [fetchPdfBytesFromUrl, fetchPdfBytesFromTab];

  if (isLocalFile && !(await hasFileSchemeAccess())) {
    throw new Error(localFileAccessError(pdf));
  }

  for (const strategy of strategies) {
    try {
      return await strategy(pdf);
    } catch (err) {
      errors.push(err);
    }
  }

  throw new Error(isLocalFile
    ? localFileAccessError(pdf)
    : `Could not fetch ${truncate(pdf.title, 30)}.`);
}

async function fetchPdfBytesFromUrl(pdf) {
  const resp = await fetch(pdf.url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

async function fetchPdfBytesFromTab(pdf) {
  if (!pdf.tabId || !pdf.url) {
    throw new Error('Missing PDF tab details');
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: pdf.tabId },
    args: [pdf.url],
    func: async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const bytes = new Uint8Array(await response.arrayBuffer());
      const chunkSize = 0x8000;
      let binary = '';

      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
      }

      return btoa(binary);
    }
  });

  const base64 = results && results[0] && results[0].result;
  if (!base64) {
    throw new Error('PDF tab did not return bytes');
  }

  return base64ToBytes(base64);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function isFileUrl(url) {
  return /^file:\/\//i.test(String(url || ''));
}

function hasFileSchemeAccess() {
  return new Promise(resolve => {
    if (!chrome.extension || !chrome.extension.isAllowedFileSchemeAccess) {
      resolve(true);
      return;
    }

    chrome.extension.isAllowedFileSchemeAccess(resolve);
  });
}

function localFileAccessError(pdf) {
  return `Could not fetch ${truncate(pdf.title, 30)}. In Edge, enable "Allow access to file URLs" for this extension, then reload the PDF tabs.`;
}

function buildMergeResultMessage(totalPages, mergedCount, skippedPdfs) {
  const base = `Merged ${totalPages} pages from ${mergedCount} PDFs`;
  const skippedNames = formatSkippedPdfNames(skippedPdfs);
  return skippedNames ? `${base}. Edge blocked: ${skippedNames}` : base;
}

function formatSkippedPdfNames(skippedPdfs) {
  if (!skippedPdfs.length) return '';

  const names = skippedPdfs
    .slice(0, 2)
    .map(({ pdf }) => truncate(pdf.title, 22))
    .join(', ');
  const more = skippedPdfs.length > 2 ? ` +${skippedPdfs.length - 2} more` : '';

  return names + more;
}

function savePdfBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function setBusy(isBusy, label = '') {
  mergeBtn.disabled = isBusy || selected.size < 2;
  if (isBusy) {
    mergeBtn.classList.add('loading');
    mergeBtn.innerHTML = `<div class="spinner"></div><span>${escHtml(label)}</span>`;
    return;
  }

  mergeBtn.classList.remove('loading');
  mergeBtn.innerHTML = `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 10h12M10 4l6 6-6 6"/>
    </svg>
    <span id="mergeBtnLabel">Merge &amp; Download</span>
  `;
  updateCounts();
}

function getShortUrl(url) {
  try { return new URL(url).hostname; } catch { return String(url || '').slice(0, 40); }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, max) {
  const value = String(str || '');
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

loadPdfs();
