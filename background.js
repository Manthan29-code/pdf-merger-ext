// background.js — tracks PDF tabs across sessions (in-memory only, no localStorage)

// In-memory store: tabId -> { url, title, tabId }
const pdfTabs = new Map();

function isPDF(url, title) {
  if (!url) return false;
  // Direct .pdf URL
  if (/\.pdf(\?.*)?$/i.test(url)) return true;
  // Google Docs PDF viewer
  if (url.includes('docs.google.com/viewer') && url.includes('.pdf')) return true;
  // Chrome built-in PDF viewer
  if (url.startsWith('chrome-extension://') && url.includes('pdf')) return true;
  // PDF.js viewer
  if (url.includes('pdfjs') || url.includes('pdf.js')) return true;
  // Firefox/browser inline viewer (blob or data URLs with pdf mime hint)
  if ((url.startsWith('blob:') || url.startsWith('data:application/pdf'))) return true;
  return false;
}

function updateTab(tab) {
  if (!tab || !tab.id || tab.id < 0) return;
  if (isPDF(tab.url, tab.title)) {
    pdfTabs.set(tab.id, {
      tabId: tab.id,
      url: tab.url,
      title: tab.title || tab.url || 'Untitled PDF',
      favIconUrl: tab.favIconUrl || ''
    });
  } else {
    pdfTabs.delete(tab.id);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateTab(tab);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pdfTabs.delete(tabId);
});

chrome.tabs.onCreated.addListener((tab) => {
  updateTab(tab);
});

// Refresh all current tabs on extension load
chrome.tabs.query({}, (tabs) => {
  if (chrome.runtime.lastError) {
    console.warn('chrome.tabs.query failed on init:', chrome.runtime.lastError);
    return;
  }
  if (!tabs || !tabs.forEach) return;
  tabs.forEach(updateTab);
});

// Message handler for popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_PDF_TABS') {
    // Also do a fresh query to catch anything we missed
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError) {
        console.warn('chrome.tabs.query failed in GET_PDF_TABS:', chrome.runtime.lastError);
        // Respond with whatever we currently know
        sendResponse({ pdfs: Array.from(pdfTabs.values()) });
        return;
      }
      if (!tabs || !tabs.forEach) {
        sendResponse({ pdfs: Array.from(pdfTabs.values()) });
        return;
      }
      // Update our map with latest state
      tabs.forEach(tab => {
        if (isPDF(tab.url, tab.title)) {
          pdfTabs.set(tab.id, {
            tabId: tab.id,
            url: tab.url,
            title: tab.title || tab.url || 'Untitled PDF',
            favIconUrl: tab.favIconUrl || ''
          });
        }
      });
      // Remove stale entries
      const currentIds = new Set(tabs.map(t => t.id));
      for (const id of pdfTabs.keys()) {
        if (!currentIds.has(id)) pdfTabs.delete(id);
      }
      sendResponse({ pdfs: Array.from(pdfTabs.values()) });
    });
    return true; // async
  }

  if (msg.type === 'FOCUS_TAB') {
    chrome.tabs.update(msg.tabId, { active: true }, () => {
      if (chrome.runtime.lastError) {
        console.warn('chrome.tabs.update failed in FOCUS_TAB:', chrome.runtime.lastError);
      }
      chrome.tabs.get(msg.tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.warn('chrome.tabs.get failed in FOCUS_TAB:', chrome.runtime.lastError);
          return;
        }
        if (tab) chrome.windows.update(tab.windowId, { focused: true }, () => {
          if (chrome.runtime.lastError) console.warn('chrome.windows.update failed in FOCUS_TAB:', chrome.runtime.lastError);
        });
      });
    });
    sendResponse({ ok: true });
    return true;
  }
});
