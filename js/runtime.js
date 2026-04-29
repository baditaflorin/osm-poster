// =====================================================================
// OSM Poster — runtime preamble
// Module destructuring + global error handlers + Loader.
// Loaded first of the inline-extracted scripts. Variables declared at the
// top level of a classic <script> are visible to subsequent classic
// <script>s via the shared global lexical environment.
// =====================================================================

// =====================================================================
// Module destructuring — clear contracts. Pure helpers come from
// LIB (./js/lib.js); data constants from DATA (./js/data.js).
// Anything below treats these as imports.
// =====================================================================
const {
  // Color
  darken, lighten, lum, haloFor, hsl,
  // Coords + format
  dms, formatDecimalCoords,
  // Map helpers
  dashFor,
  // Random
  mulberry32, seedToInt,
  // Resilience
  reportError, safe, safeAsync,
  // DOM
  bindEl, escapeHtml,
} = LIB;

const {
  TEMPLATE_FIELDS,
  LAYER_ORDER, LAYER_LABELS, LAYER_GROUPS,
  PALETTE_KEYS, PALETTE_LABELS,
  CITIES, ICON_CATEGORIES,
  COMPASS_VARIANTS, ORNAMENTS, ROAD_MODES, TOD_FILTERS,
  SAMPLE_MASK_DATAURL, PINHEAD_BASE,
} = DATA;

window.addEventListener('error', e => { if (e.error) reportError(e.error, 'window'); });
window.addEventListener('unhandledrejection', e => reportError(e.reason, 'promise'));

// =====================================================================
// LOADING BAR — discrete top-of-viewport line, no text
// Reference-counted so multiple concurrent loads keep it lit.
// =====================================================================
const Loader = (function() {
  let n = 0;
  const el = () => document.getElementById('loading-bar');
  return {
    push() { n++; const e = el(); if (e) e.classList.add('active'); },
    pop()  { n = Math.max(0, n - 1); if (n === 0) { const e = el(); if (e) e.classList.remove('active'); } },
    reset() { n = 0; const e = el(); if (e) e.classList.remove('active'); },
    track(promise) { this.push(); return Promise.resolve(promise).finally(() => this.pop()); },
  };
})();
