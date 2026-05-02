// compress-merge.js - output-size options for merged PDFs

window.CompressMerge = (() => {
  let enabled = false;
  let quality = 70;

  function bind({ checkbox, slider, value }) {
    if (!checkbox || !slider || !value) return;

    enabled = checkbox.checked;
    quality = Number(slider.value) || quality;
    updateLabel(value);

    checkbox.addEventListener('change', () => {
      enabled = checkbox.checked;
      slider.disabled = !enabled;
      updateLabel(value);
    });

    slider.addEventListener('input', () => {
      quality = Number(slider.value) || quality;
      updateLabel(value);
    });
  }

  function settings() {
    return { enabled, quality };
  }

  async function save(document) {
    return document.save({
      addDefaultPage: false,
      objectsPerTick: enabled ? Math.max(20, Math.round(120 - quality)) : 50,
      useObjectStreams: enabled
    });
  }

  function hint() {
    if (!enabled) return 'Standard output';
    if (quality >= 80) return 'Light compression';
    if (quality >= 50) return 'Balanced compression';
    return 'Smaller output';
  }

  function updateLabel(value) {
    value.textContent = enabled ? `${quality}%` : 'off';
  }

  return { bind, hint, save, settings };
})();
