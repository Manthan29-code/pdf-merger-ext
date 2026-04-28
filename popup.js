// popup.js — all in-memory, no localStorage

// ─── State (in-memory only) ──────────────────────────────────────
let allPdfs = [];        // [{ tabId, url, title }]
let selected = new Set();// Set of tabId
let order = [];          // ordered array of tabId

// ─── DOM refs ───────────────────────────────────────────────────
const pdfList    = document.getElementById('pdfList');
const emptyState = document.getElementById('emptyState');
const toolbar    = document.getElementById('toolbar');
const selCount   = document.getElementById('selCount');
const mergeBtn   = document.getElementById('mergeBtn');
const mergeBtnLabel = document.getElementById('mergeBtnLabel');
const refreshBtn = document.getElementById('refreshBtn');
const selectAllBtn   = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');
const footerHint = document.getElementById('footerHint');
const progressWrap = document.getElementById('progressWrap');
const progressBar  = document.getElementById('progressBar');
const toastEl    = document.getElementById('toast');

// ─── Toast ───────────────────────────────────────────────────────
let toastTimer;
function toast(msg, isError = false) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (isError ? ' error' : '');
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 2800);
}

// ─── Progress ────────────────────────────────────────────────────
function setProgress(pct) {
  if (pct === null) {
    progressWrap.classList.remove('visible');
    progressBar.style.width = '0%';
  } else {
    progressWrap.classList.add('visible');
    progressBar.style.width = pct + '%';
  }
}

// ─── Fetch PDF tabs from background ─────────────────────────────
function loadPdfs() {
  refreshBtn.style.opacity = '0.4';
  chrome.runtime.sendMessage({ type: 'GET_PDF_TABS' }, (res) => {
    refreshBtn.style.opacity = '';
    if (chrome.runtime.lastError || !res) {
      toast('Could not reach background service', true);
      return;
    }

    const incoming = res.pdfs || [];

    // Preserve existing order for tabs still present
    const incomingIds = new Set(incoming.map(p => p.tabId));
    const newOrder = order.filter(id => incomingIds.has(id));

    // Append any new IDs not yet in order
    for (const p of incoming) {
      if (!newOrder.includes(p.tabId)) newOrder.push(p.tabId);
    }

    // Remove selected that are no longer present
    for (const id of selected) {
      if (!incomingIds.has(id)) selected.delete(id);
    }

    allPdfs = incoming;
    order   = newOrder;
    render();
  });
}

// ─── Render list ─────────────────────────────────────────────────
function render() {
  const hasPdfs = allPdfs.length > 0;
  emptyState.style.display = hasPdfs ? 'none' : 'flex';
  toolbar.style.display     = hasPdfs ? 'flex' : 'none';

  pdfList.innerHTML = '';

  const map = Object.fromEntries(allPdfs.map(p => [p.tabId, p]));

  order.forEach((tabId, idx) => {
    const pdf = map[tabId];
    if (!pdf) return;
    const isChecked = selected.has(tabId);
    pdfList.appendChild(buildItem(pdf, idx + 1, isChecked));
  });

  updateCounts();
  attachDragEvents();
}

// ─── Build single PDF item ────────────────────────────────────────
function buildItem(pdf, num, isChecked) {
  const item = document.createElement('div');
  item.className = 'pdf-item' + (isChecked ? ' selected' : '');
  item.dataset.id = pdf.tabId;

  const shortUrl = (() => {
    try { return new URL(pdf.url).hostname; } catch { return pdf.url.slice(0, 40); }
  })();

  item.innerHTML = `
    <div class="drag-handle" draggable="true" title="Drag to reorder">
      <svg viewBox="0 0 12 12" fill="currentColor">
        <circle cx="3.5" cy="2.5" r="1"/><circle cx="8.5" cy="2.5" r="1"/>
        <circle cx="3.5" cy="6" r="1"/><circle cx="8.5" cy="6" r="1"/>
        <circle cx="3.5" cy="9.5" r="1"/><circle cx="8.5" cy="9.5" r="1"/>
      </svg>
    </div>
    <div class="check-wrap">
      <div class="check ${isChecked ? 'checked' : ''}" data-id="${pdf.tabId}">
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
      <div class="pdf-title" data-tabid="${pdf.tabId}" title="${escHtml(pdf.title)}">${escHtml(truncate(pdf.title, 45))}</div>
      <div class="pdf-url">${escHtml(shortUrl)}</div>
    </div>
    <div class="order-num">${num}</div>
  `;

  // Click checkbox
  item.querySelector('.check').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSelect(pdf.tabId);
  });

  // Click title → focus tab
  item.querySelector('.pdf-title').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'FOCUS_TAB', tabId: pdf.tabId });
  });

  // Click row → toggle (except drag handle and title)
  item.addEventListener('click', (e) => {
    if (e.target.closest('.drag-handle') || e.target.closest('.pdf-title')) return;
    toggleSelect(pdf.tabId);
  });

  return item;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ─── Select / Deselect ───────────────────────────────────────────
function toggleSelect(tabId) {
  if (selected.has(tabId)) selected.delete(tabId);
  else selected.add(tabId);
  render();
}

function updateCounts() {
  const total = allPdfs.length;
  const sel   = selected.size;
  selCount.textContent = `${sel} / ${total}`;

  const enabled = sel >= 2;
  mergeBtn.disabled = !enabled;
  footerHint.textContent = sel === 0
    ? 'Select PDFs above to merge them'
    : sel === 1
    ? 'Select at least one more PDF'
    : `${sel} PDFs selected — ready to merge`;
}

selectAllBtn.addEventListener('click', () => {
  allPdfs.forEach(p => selected.add(p.tabId));
  render();
});
deselectAllBtn.addEventListener('click', () => {
  selected.clear();
  render();
});

// ─── Drag-and-drop reorder ───────────────────────────────────────
let dragSrcId = null;

function attachDragEvents() {
  const items = pdfList.querySelectorAll('.pdf-item');
  items.forEach(item => {
    const handle = item.querySelector('.drag-handle');

    handle.addEventListener('dragstart', (e) => {
      dragSrcId = parseInt(item.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      // small delay so the item visually shows as dragging
      setTimeout(() => item.classList.add('dragging'), 0);
    });

    handle.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      pdfList.querySelectorAll('.pdf-item').forEach(i => i.classList.remove('drag-over'));
      dragSrcId = null;
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (parseInt(item.dataset.id) !== dragSrcId) {
        pdfList.querySelectorAll('.pdf-item').forEach(i => i.classList.remove('drag-over'));
        item.classList.add('drag-over');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const targetId = parseInt(item.dataset.id);
      if (dragSrcId !== null && dragSrcId !== targetId) {
        const srcIdx = order.indexOf(dragSrcId);
        const tgtIdx = order.indexOf(targetId);
        if (srcIdx !== -1 && tgtIdx !== -1) {
          order.splice(srcIdx, 1);
          order.splice(tgtIdx, 0, dragSrcId);
          render();
        }
      }
    });
  });
}

// ─── Merge & Download ────────────────────────────────────────────
mergeBtn.addEventListener('click', async () => {
  // Build ordered list of selected PDFs
  const map = Object.fromEntries(allPdfs.map(p => [p.tabId, p]));
  const toMerge = order.filter(id => selected.has(id)).map(id => map[id]).filter(Boolean);

  if (toMerge.length < 2) {
    toast('Please select at least 2 PDFs', true);
    return;
  }

  // UI → loading
  mergeBtn.disabled = true;
  mergeBtn.classList.add('loading');
  mergeBtn.innerHTML = `<div class="spinner"></div><span>Merging…</span>`;
  setProgress(5);

  try {
    const { PDFDocument } = PDFLib;
    const merged = await PDFDocument.create();

    for (let i = 0; i < toMerge.length; i++) {
      const pdf = toMerge[i];
      setProgress(5 + Math.round((i / toMerge.length) * 85));

      let bytes;
      try {
        const resp = await fetch(pdf.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = await resp.arrayBuffer();
        bytes = new Uint8Array(buf);
      } catch (fetchErr) {
        toast(`Could not fetch: ${truncate(pdf.title, 30)}`, true);
        throw fetchErr;
      }

      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages  = await merged.copyPages(srcDoc, srcDoc.getPageIndices());
      pages.forEach(page => merged.addPage(page));
    }

    setProgress(95);
    const outBytes = await merged.save();
    setProgress(100);

    // Trigger download
    const blob = new Blob([outBytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `merged-${toMerge.length}-pdfs.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    toast(`✓ Merged ${toMerge.length} PDFs downloaded!`);
    setTimeout(() => setProgress(null), 1000);

  } catch (err) {
    console.error('Merge error:', err);
    if (!err.message?.includes('Could not fetch')) {
      toast('Merge failed — check console for details', true);
    }
    setProgress(null);
  } finally {
    mergeBtn.classList.remove('loading');
    mergeBtn.disabled = selected.size < 2;
    mergeBtn.innerHTML = `
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 10h12M10 4l6 6-6 6"/>
      </svg>
      <span id="mergeBtnLabel">Merge &amp; Download</span>
    `;
  }
});

// ─── Refresh button ──────────────────────────────────────────────
refreshBtn.addEventListener('click', loadPdfs);

// ─── Init ────────────────────────────────────────────────────────
loadPdfs();
