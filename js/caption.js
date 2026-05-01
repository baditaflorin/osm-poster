// =====================================================================
// OSM Poster — caption-block variants (ADR-141..160)
// Drives the caption layout via classes on #poster + CSS variables.
// All the CSS lives in css/poster.css — this module just toggles
// the appropriate state-derived classes and runs the JS-only effects
// (auto-fit, auto-contrast, monogram, word spacing).
// =====================================================================

const CAPTION_LAYOUTS = [
  'block', 'overlay', 'banner', 'stamp', 'monogram',
  'vertical-left', 'vertical-right', 'cover', 'hidden',
];
const CAPTION_POSITIONS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
const CAPTION_PADDINGS  = ['flush', 'cozy', 'breathing', 'loose'];

// =====================================================================
// applyCaptionLayout — single entry point for all caption-related
// CSS classes. Called from applyState so undo/redo and hash loads
// pick up changes for free.
// =====================================================================
function applyCaptionLayout() {
  const poster = document.getElementById('poster');
  if (!poster) return;

  // Strip every caption-* class first so a state change wipes prior
  // mode classes cleanly.
  Array.from(poster.classList).forEach(c => {
    if (c.startsWith('caption-') || c === 'title-outline' || c === 'title-gradient' || c === 'title-only') {
      poster.classList.remove(c);
    }
  });

  // Layout mode
  const layout = state.captionLayout || 'block';
  if (CAPTION_LAYOUTS.includes(layout)) {
    poster.classList.add('caption-' + layout);
  }

  // Overlay/stamp position
  const pos = state.captionPos || 'bc';
  if (CAPTION_POSITIONS.includes(pos)) {
    poster.classList.add('caption-pos-' + pos);
  }

  // Block-mode padding
  const pad = state.captionPadding || 'breathing';
  if (CAPTION_PADDINGS.includes(pad)) {
    poster.classList.add('caption-pad-' + pad);
  }

  // Boolean flags
  if (state.titleOnly)           poster.classList.add('title-only');
  if (state.titleOutline)        poster.classList.add('title-outline');
  if (state.titleGradient)       poster.classList.add('title-gradient');
  if (state.captionTextShadow)   poster.classList.add('caption-text-shadow');
  if (state.captionBackdropBlur) poster.classList.add('caption-blur');

  // bg opacity (CSS variable on #caption)
  const cap = document.getElementById('caption');
  if (cap) {
    const a = (typeof state.captionBgOpacity === 'number') ? state.captionBgOpacity : 100;
    cap.style.setProperty('--caption-bg-alpha', (a / 100).toFixed(2));
  }

  // ADR-151 monogram — replace title text with first letter only.
  // Restore on layout change. Using a separate data attribute so we
  // never lose the original title.
  const titleEl = document.getElementById('caption-title');
  if (titleEl) {
    if (layout === 'monogram') {
      const original = state.caption.title || '';
      const first = (original.match(/\S/) || [''])[0].toUpperCase();
      titleEl.dataset.fullTitle = original;
      titleEl.textContent = first;
    } else if (titleEl.dataset.fullTitle != null) {
      // Restore — title input + state already hold the full title.
      titleEl.textContent = state.caption.title || '';
      delete titleEl.dataset.fullTitle;
    }
  }

  // ADR-158 word-spacing — wrap each word in a span for per-word kerning.
  if (titleEl && layout !== 'monogram') {
    if (state.titleWordSpace) {
      const t = state.caption.title || '';
      titleEl.innerHTML = t.split(/\s+/).map(w => `<span class="title-word">${escapeHtml(w)}</span>`).join(' ');
    } else if (titleEl.querySelector('.title-word')) {
      // Restore plain text
      titleEl.textContent = state.caption.title || '';
    }
  }

  // ADR-150 title auto-fit — measure and resize.
  if (state.titleAutoFit) {
    requestAnimationFrame(() => fitTitleToWidth());
  }

  // ADR-144 auto-contrast — kicks off a sample-and-flip after the map idles.
  if (state.captionAutoContrast) {
    requestAnimationFrame(() => updateAutoContrast());
  } else if (cap) {
    cap.style.removeProperty('--caption-text-color');
  }
}

// =====================================================================
// ADR-150 — Title auto-fit. Measures the rendered title width and
// scales font-size so it fills ~85% of the available caption width.
// =====================================================================
function fitTitleToWidth() {
  const titleEl = document.getElementById('caption-title');
  const cap     = document.getElementById('caption');
  if (!titleEl || !cap || !titleEl.offsetWidth) return;
  const containerW = cap.clientWidth - 32; // account for padding
  if (containerW <= 0) return;
  // Reset to a baseline size first so re-runs don't shrink forever.
  titleEl.style.fontSize = '';
  const naturalW = titleEl.scrollWidth;
  if (naturalW < 1) return;
  const target = containerW * 0.85;
  const ratio = target / naturalW;
  // Read current size in px and apply ratio.
  const currentSize = parseFloat(window.getComputedStyle(titleEl).fontSize) || 30;
  const newSize = Math.max(14, Math.min(120, currentSize * ratio));
  titleEl.style.fontSize = newSize.toFixed(1) + 'px';
}

// =====================================================================
// ADR-144 — Auto-contrast. Sample the map canvas underneath the
// caption's bounding box, compute average luminance, set
// --caption-text-color on #caption.
// =====================================================================
function updateAutoContrast() {
  const cap = document.getElementById('caption');
  if (!cap || !state.captionAutoContrast) return;
  if (typeof map === 'undefined' || !map || !map.getCanvas) return;
  try {
    const canvas = map.getCanvas();
    const wrap   = document.getElementById('map-wrap');
    if (!canvas || !wrap) return;
    const cBox = cap.getBoundingClientRect();
    const wBox = wrap.getBoundingClientRect();
    // Where is the caption rectangle inside the map canvas's coordinate space?
    const dpr = (canvas.width / wrap.clientWidth) || 1;
    const ix = Math.max(0, Math.round((cBox.left - wBox.left) * dpr));
    const iy = Math.max(0, Math.round((cBox.top  - wBox.top ) * dpr));
    const iw = Math.max(1, Math.min(canvas.width  - ix, Math.round(cBox.width  * dpr)));
    const ih = Math.max(1, Math.min(canvas.height - iy, Math.round(cBox.height * dpr)));
    if (iw < 4 || ih < 4) return;
    // Sample a sparse grid (8x4) rather than every pixel — much faster.
    const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!ctx) return;
    // We can't getImageData on a WebGL canvas without preserveDrawingBuffer.
    // MapLibre is configured with preserveDrawingBuffer:true so toDataURL
    // works. For perf we fall back to a small offscreen 2D copy.
    const off = document.createElement('canvas');
    off.width = 8; off.height = 4;
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.drawImage(canvas, ix, iy, iw, ih, 0, 0, 8, 4);
    const data = octx.getImageData(0, 0, 8, 4).data;
    let sum = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      // ITU-R BT.601 luminance. Skip fully-transparent pixels.
      if (data[i + 3] < 8) continue;
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      count++;
    }
    if (count < 4) return;
    const avg = sum / count;
    const textColor = avg < 128 ? '#fafafa' : '#1a1a1a';
    cap.style.setProperty('--caption-text-color', textColor);
  } catch (_) {}
}
// Refresh auto-contrast on map idle so panning re-flips the colour.
if (typeof map !== 'undefined' && map) {
  map.on('idle', () => { if (state.captionAutoContrast) updateAutoContrast(); });
}

// =====================================================================
// ADR-160 — Caption layout presets. Atomic chip that snaps multiple
// caption-related state fields at once. Custom edits afterward stay;
// reselecting the chip resets them.
// =====================================================================
const CAPTION_PRESETS = {
  classic:  { captionLayout: 'block',          captionPos: 'bc', captionBgOpacity: 100, captionPadding: 'breathing', captionAutoContrast: false, captionBackdropBlur: false, titleOnly: false, titleOutline: false, captionTextShadow: false, titleGradient: false },
  hidden:   { captionLayout: 'hidden',         captionPos: 'bc' },
  floating: { captionLayout: 'overlay',        captionPos: 'bc', captionBgOpacity: 0,   captionAutoContrast: true,  captionBackdropBlur: true,  captionTextShadow: true,  titleOnly: false },
  cover:    { captionLayout: 'cover',          captionPos: 'tl', captionBgOpacity: 0,   captionAutoContrast: true,  captionTextShadow: true },
  banner:   { captionLayout: 'banner',         captionPos: 'tc', captionBgOpacity: 100, captionPadding: 'cozy' },
  stamp:    { captionLayout: 'stamp',          captionPos: 'br', captionBgOpacity: 95 },
  monogram: { captionLayout: 'monogram',       captionAutoContrast: true,  captionTextShadow: true },
  vertical: { captionLayout: 'vertical-left',  captionBgOpacity: 0, captionTextShadow: false, titleOnly: true },
};
function applyCaptionPreset() {
  const p = CAPTION_PRESETS[state.captionPreset];
  if (!p) return;
  Object.assign(state, p);
  applyCaptionLayout();
  if (typeof syncChipGroups === 'function') syncChipGroups();
}
