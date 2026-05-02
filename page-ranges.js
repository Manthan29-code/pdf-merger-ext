// page-ranges.js - per-PDF page range parsing and state

window.PageRanges = (() => {
  const ranges = new Map();

  function set(tabId, value) {
    const cleaned = String(value || '').replace(/\s+/g, '');
    if (cleaned) ranges.set(tabId, cleaned);
    else ranges.delete(tabId);
  }

  function get(tabId) {
    return ranges.get(tabId) || '';
  }

  function prune(activeIds) {
    for (const tabId of ranges.keys()) {
      if (!activeIds.has(tabId)) ranges.delete(tabId);
    }
  }

  function parse(input, totalPages) {
    const raw = String(input || '').trim();
    if (!raw) return Array.from({ length: totalPages }, (_, index) => index);

    const pages = [];
    const seen = new Set();
    const parts = raw.split(',').map(part => part.trim()).filter(Boolean);

    for (const part of parts) {
      const match = part.match(/^(\d+)(?:-(\d+))?$/);
      if (!match) throw new Error(`Invalid page range "${part}"`);

      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : start;

      if (start < 1 || end < 1 || start > end) {
        throw new Error(`Invalid page range "${part}"`);
      }
      if (end > totalPages) {
        throw new Error(`Page ${end} is outside a ${totalPages}-page PDF`);
      }

      for (let page = start; page <= end; page += 1) {
        const index = page - 1;
        if (!seen.has(index)) {
          seen.add(index);
          pages.push(index);
        }
      }
    }

    if (!pages.length) throw new Error('Choose at least one page');
    return pages;
  }

  function label(input) {
    return String(input || '').trim() || 'all pages';
  }

  return { get, label, parse, prune, set };
})();
