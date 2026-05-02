// split-pdf.js - extract selected pages from one PDF tab

window.SplitPdfFeature = (() => {
  async function split(pdf, rangeText, helpers) {
    const { fetchPdfBytes, savePdfBytes, setProgress, toast, truncate } = helpers;
    const { PDFDocument } = PDFLib;

    setProgress(10);
    const bytes = await fetchPdfBytes(pdf);
    const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageIndices = PageRanges.parse(rangeText, srcDoc.getPageCount());

    setProgress(55);
    const outDoc = await PDFDocument.create();
    const pages = await outDoc.copyPages(srcDoc, pageIndices);
    pages.forEach(page => outDoc.addPage(page));

    setProgress(85);
    const outBytes = await outDoc.save({ useObjectStreams: true });
    savePdfBytes(outBytes, `split-${safeName(pdf.title)}.pdf`);
    setProgress(100);

    toast(`Extracted ${pageIndices.length} page${pageIndices.length === 1 ? '' : 's'} from ${truncate(pdf.title, 24)}`);
  }

  function safeName(name) {
    return String(name || 'pdf')
      .replace(/\.pdf$/i, '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 48) || 'pdf';
  }

  return { split };
})();
