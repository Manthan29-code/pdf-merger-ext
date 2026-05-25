<div align="center">

# 📄 PDF Tab Merger

### Merge PDFs from your open browser tabs — instantly, privately, offline.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](.) [![Manifest V3](https://img.shields.io/badge/Manifest-V3-navy)](.) [![Offline](https://img.shields.io/badge/Works-Offline-2B3A55)](.) [![Zero Data](https://img.shields.io/badge/Zero%20Data%20Stored-D4845A)](.) [![License MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)


[Install](#-installation) · [How it works](#-how-it-works-technical) · [Contribute](#-contribute) · [Screenshots](#-screenshots)

</div>

---

## The problem with online PDF mergers

You've been there. You have 4 PDFs open in browser tabs — a report, a receipt, a form, an invoice — and you need to merge them into one file. So you do what everyone does: you Google "merge PDF online."

And then you upload your files to a random website.

> **Stop. Think about what you just did.**

You uploaded your private documents — potentially containing contracts, personal information, medical records, or financial data — to a server you know nothing about. You have no idea where those files go, how long they're stored, whether they're scanned, sold, or retained. The site says "files deleted after 1 hour." Maybe they are. Maybe they aren't. You'll never know.

**There's a better way.**

---

## Why PDF Tab Merger is different

| | Online PDF Tools | PDF Tab Merger |
|---|---|---|
| 🔒 **Privacy** | Files uploaded to unknown servers | Never leaves your device |
| 🌐 **Internet required** | Yes — always | No — works fully offline |
| ⚡ **Speed** | Upload → wait → download | Instant, local processing |
| 💾 **File size limits** | Usually 10–25 MB cap | No limits — your RAM is the limit |
| 📊 **Data collection** | Often tracked, sometimes monetized | Zero. Nothing. Not a byte. |
| 🔄 **Workflow** | Download each PDF, re-upload them | Already in your tabs — one click |
| 💰 **Cost** | Free tier + upsells, or subscription | Free. Forever. Open source. |
| 🧩 **Custom order** | Sometimes, clunky | Drag-and-drop, visual, instant |

---

## What it does

PDF Tab Merger sits quietly in your browser toolbar. When you have PDFs open in your tabs, it:

- **Detects them automatically** — no manual file selection, no drag-and-drop from Finder/Explorer
- **Lets you pick which ones** to include, with checkboxes
- **Lets you set the order** by dragging items up and down
- **Lets you choose page ranges** per file, like `1-3`, `2,5,9`, or blank for all pages
- **Splits a single PDF** by extracting the chosen page range into a new download
- **Optionally compresses merged output** with a quality slider for smaller saved PDFs
- **Merges and downloads** the result as a single PDF — entirely in your browser, using your CPU, with no network request made

Your documents never leave your machine. Not even to `localhost`.

---

## ✨ Features

- **Auto-detection** of all PDF tabs — including `.pdf` URLs, Google Docs viewer, PDF.js, and blob PDFs
- **Select / deselect** individual PDFs with one click
- **Select All / Clear** toolbar buttons for bulk actions
- **Drag-and-drop reordering** — set the exact page order before merging
- **Page range selection** — include all pages or specify exact ranges per PDF before merging
- **Split PDF** — extract selected pages from one open PDF tab into a standalone PDF
- **Compress on merge** — re-save merged PDFs with object streams and a quality preference slider
- **Click any title** to jump directly to that tab
- **Progress bar** during merge so you know it's working
- **Fixed popup** — 380×560px with a scrollbar if you have many PDFs open
- **Fully offline** — pdf-lib is bundled locally, zero CDN calls
- **Zero persistence** — closes the popup? State resets. Nothing written anywhere.

---

## 🚀 Installation

### From source (developer mode)

```bash
# 1. Clone the repo
git clone https://github.com/Manthan29-code/pdf-merger-ext.git
cd pdf-tab-merger

# 2. No build step needed — it's plain JS
```

Then in Chrome:

1. Navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the `pdf-tab-merger/` folder
5. Pin the extension from the puzzle-piece menu in your toolbar

> check Read the [Troubleshooting Guide](Permission.md) if your broswer don't allow to access  PDF file . 
> Chrome Web Store release coming soon. Star the repo to get notified. ⭐

---

## 🔧 How it works (technical)

This section is for developers and curious minds who want to understand what's happening under the hood.

### Architecture overview

```
┌─────────────────────────────────────────────────────┐
│                   Chrome Browser                    │
│                                                     │
│  ┌──────────┐    messages     ┌──────────────────┐  │
│  │ popup.js │ ◄────────────── │  background.js   │  │
│  │          │ ────────────►   │  (service worker)│  │
│  └──────────┘                 └──────────────────┘  │
│       │                              │              │
│       │ pdf-lib (local)              │ tabs API     │
│       ▼                              ▼              │
│  ┌──────────┐                 ┌──────────────────┐  │
│  │ PDF merge│                 │  Browser Tabs    │  │
│  │ in-memory│                 │  (URL inspection)│  │
│  └──────────┘                 └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Manifest V3 service worker

The extension uses **Manifest V3**, Chrome's current extension standard. Background logic runs as a **service worker** (`background.js`) rather than a persistent background page. This means:

- The service worker can be terminated when idle and restarted on demand
- State is held in a `Map` in memory — intentionally ephemeral
- No `localStorage`, no `chrome.storage`, no IndexedDB

```javascript
// background.js — all state lives here, nowhere else
const pdfTabs = new Map(); // tabId → { url, title, tabId }
```

### PDF detection logic

Tab URLs are inspected against a set of heuristics:

```javascript
function isPDF(url) {
  if (/\.pdf(\?.*)?$/i.test(url)) return true;          // direct .pdf URL
  if (url.includes('docs.google.com/viewer')) return true; // Google Docs viewer
  if (url.startsWith('blob:')) return true;              // blob PDFs
  if (url.includes('pdfjs')) return true;                // PDF.js viewer
  // ...
}
```

Events that trigger re-evaluation: `tabs.onUpdated`, `tabs.onCreated`, `tabs.onRemoved`. Every popup open also fires a fresh `tabs.query({})` to catch anything the service worker missed while idle.

### Message passing

Popup ↔ background communicate via `chrome.runtime.sendMessage`:

```javascript
// popup.js asks for current PDF tabs
chrome.runtime.sendMessage({ type: 'GET_PDF_TABS' }, (res) => {
  // res.pdfs = [{ tabId, url, title }]
});

// background.js responds with a fresh query result
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_PDF_TABS') {
    chrome.tabs.query({}, (tabs) => {
      // filter and respond
      sendResponse({ pdfs: ... });
    });
    return true; // critical: keeps channel open for async response
  }
});
```

### PDF merging, page ranges, and splitting

The actual PDF work happens in the popup using [pdf-lib](https://pdf-lib.js.org/), a pure JavaScript PDF manipulation library with no native dependencies. `popup.js` coordinates the UI, while feature modules keep the range parsing, splitting, and compression behavior separate.

```javascript
const { PDFDocument } = PDFLib;
const merged = await PDFDocument.create();

for (const pdf of selectedPdfsInOrder) {
  const bytes = await fetch(pdf.url).then(r => r.arrayBuffer());
  const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pageIndices = PageRanges.parse(PageRanges.get(pdf.tabId), srcDoc.getPageCount());
  const pages = await merged.copyPages(srcDoc, pageIndices);
  pages.forEach(page => merged.addPage(page));
}

const outBytes = await CompressMerge.save(merged);
// → Uint8Array, then Blob, then download via <a> click
```

Page range fields accept values like `1-3`, `2,5,9`, or blank for all pages. The Split button uses the same range parser, but copies pages from just one PDF into a new output file.

Compression is intentionally local and dependency-light: it re-saves the merged PDF with pdf-lib object streams and quality preference settings. It can reduce output size for some PDFs, but it does not downsample embedded images.

The `ignoreEncryption: true` flag allows reading password-protected PDFs that have their protection metadata set but are otherwise readable — useful for PDFs with "open" but no actual password enforcement.

### Drag-and-drop ordering

Order is maintained as a plain array of `tabId` values. Drag events update this array, and the list re-renders:

```javascript
let order = []; // e.g. [42, 7, 19] — tabIds in display/merge order

// On drop:
order.splice(srcIdx, 1);          // remove from old position
order.splice(tgtIdx, 0, dragSrcId); // insert at new position
render(); // re-renders list from order array
```

This means the visual order is decoupled from how Chrome internally tracks tabs — you can arrange them any way you want regardless of tab position.

### No data persistence — by design

This is not an oversight. It's a deliberate choice.

Every time the popup closes, the selection state is gone. Every time the service worker sleeps, the tab map may be gone (rebuilt on next message). This was chosen because:

1. PDFs you had open yesterday are not relevant today
2. Storing tab URLs persistently creates a browsing history — a privacy concern
3. The chrome.storage API exists and was explicitly not used

If you want to add optional persistence, see the [Contributing](#-contribute) section — it's a great first PR.

---

## 📁 Project structure

```
pdf-tab-merger/
├── manifest.json       # Extension config — Manifest V3
├── background.js       # Service worker: tab tracking, message handling
├── content.js          # Content script (intentionally minimal)
├── popup.html          # Extension popup UI — fixed 380×560px
├── popup.js            # Popup coordinator: render, select, drag, merge, split, download
├── page-ranges.js      # Page range state and parser, e.g. 1-3,5
├── split-pdf.js        # Extract selected pages from one PDF
├── compress-merge.js   # Merge output compression settings
├── pdf-lib.min.js      # Bundled pdf-lib v1.17.1 — no CDN, works offline
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🤝 Contribute

This project is intentionally small and readable. The popup is split into one coordinator plus small feature files, so each concern stays easy to follow. It's a great codebase to contribute to — whether you're a beginner or a seasoned developer.

### Good first issues

- [ ] **Optional persistence** — let users opt-in to remembering their last selection via `chrome.storage.session`
- [ ] **PDF preview thumbnails** — render page 1 of each PDF as a tiny preview in the list
- [ ] **Advanced compression** — optionally downsample embedded images with an offline renderer/compressor
- [ ] **Chrome Web Store release** — package, screenshots, store listing
- [ ] **Firefox support** — the extension is largely compatible with WebExtensions API; needs testing + manifest tweaks
- [ ] **Keyboard shortcuts** — select all with `Ctrl+A`, merge with `Enter`
- [ ] **Better icon** — SVG-based, beautiful icons at all sizes

### How to contribute

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/Manthan29-code/pdf-merger-ext.git
cd pdf-tab-merger

# Make your changes
# Load unpacked in chrome://extensions/ and test

git checkout -b feature/your-feature-name
git commit -m "feat: describe what you did"
git push origin feature/your-feature-name
# Open a Pull Request on GitHub
```

No build system. No bundler. No `node_modules`. Open the folder, edit a file, reload the extension. That's it.

### Design principles to preserve

1. **No data leaves the device** — ever, under any circumstance
2. **No external network requests** at runtime — pdf-lib stays bundled
3. **No persistence** — unless the user explicitly opts in
4. **One file per concern** — keep background, popup logic, and UI separate

---

## ⭐ Star & Fork

If this saved you from uploading a private document to a sketchy website, give it a star. It costs nothing and helps other people find this instead of those sites.

If you have ideas, fork it and make it yours. The MIT license means you can do whatever you want with it — build it into something bigger, white-label it, ship your own version. Just keep it private and keep it honest.

---

## 📜 License

MIT — see [LICENSE](LICENSE) for full text.

---

<div align="center">

**Built with care for people who value their privacy.**

No tracking. No analytics. No servers. Just your PDFs, merged locally.

[⭐ Star on GitHub](.) · [🍴 Fork](.) · [🐛 Report a bug](.) · [💡 Request a feature](.)

</div>
