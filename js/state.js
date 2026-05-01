// =====================================================================
// OSM Poster — state, undo/redo, persistence
// defaultState() returns the canonical poster state shape. history is a
// past/future stack for ADR-016 undo/redo. persist()/decodeHash()/etc
// mirror the live state into localStorage and the URL hash (ADR-001/002).
// =====================================================================

// =====================================================================
// STATE
// =====================================================================
function defaultState() {
  const p = clonePreset('blueprint');
  return {
    preset: 'blueprint',
    ...p,
    bearing: 0,
    pitch: 0,
    frame: 'portrait',
    border: 'none',
    texture: 'none',
    compass: false,
    compassStyle: 'classic',
    scale: false,
    dateStamp: false,
    grid: false,
    icons: {
      density: 25,
      size: 30,
      categories: {
        food: true, culture: false, shopping: false, attractions: true,
        religious: false, activity: false, outdoors: true, transit: false,
        lodging: false, services: false,
      },
      // ADR-070 — per-category density override. Missing key = use the
      // global `density` field above. Only populated when user touches
      // a per-category slider, so existing posters carry no overrides.
      densities: {},
    },
    // ADR-023 atmospheric tint: none | auto | dawn | day | golden | dusk | night
    tod: 'none',
    // ADR-031 city polygon outline
    cityOutline: false,
    cityOutlineGeo: null,   // cached GeoJSON (filled on place selection)
    // ADR-026 print bleed in PDF export
    exportBleed: false,
    // ADR-063 explicit DPI override on top of the export-size preset.
    // 'auto' = use the size preset's base multiplier; numeric = override.
    exportDpi: 'auto',
    // ADR-024 click-placed text annotations: [{ lng, lat, text }]
    annotations: [],
    // ADR-028 photo polaroids: [{ lng, lat, dataUrl, caption, rot }]
    polaroids: [],
    // ADR-027 custom font use toggle (data lives in localStorage)
    customFontOn: false,
    customFontName: null,
    // 10 new dials (ADR-032..041)
    roadCasing: false,        // wider light underlayer beneath each road
    roadGlow: false,          // line-blur on roads for neon effect
    titleOrnament: 'none',    // none | bullets | dashes | brackets | asterisks | brackets-square
    captionDivider: 'line',   // none | line | dotted | double | wave
    mapSaturation: 100,       // 0..200 (CSS filter percent)
    mapContrast: 100,         // 50..150
    vignette: 'none',          // none | soft | heavy | spotlight
    buildingShape: 'filled',  // filled | outlined | wireframe
    stars: false,             // sprinkle stars overlay
    titleSpacingDelta: 0,     // -4..+8 px adjustment over preset
    // 5 more creative dials (ADR-042..046)
    buildingHeight: 1,        // multiplier on 3D extrusion height (0.5..8)
    // 6 more style-option dials (ADR-048..053)
    roofTone: 'match',        // match | lighter | darker | accent | custom
    parkOpacity: 'normal',    // subtle | normal | bold
    labelCase: 'asis',        // asis | uppercase | lowercase
    cardShadow: 'soft',       // none | soft | hard | float
    buildingShading: true,    // fill-extrusion-vertical-gradient
    roadCaps: 'round',        // round | butt | square
    // 4 more Decoration dials (ADR-054..057)
    realisticLight: false,    // sun-position lighting on 3D extrusions via SunCalc + setLight
    sunArrow: false,          // small SVG arrow showing current sun direction at view center
    zoomDisplay: false,       // small "z 12.4" label in the corner
    frameOrnaments: false,    // vintage corner flourishes on the poster
    mapHue: 0,                // 0..360° global hue rotation
    fxMode: 'none',           // none | glitch | halftone | melt | bloom | posterize (SVG filter on #map-wrap)
    // ===== ADR-081..100: output-cleanliness pass =====
    density: 100,             // ADR-081 — 0..100, strips detail as it drops
    roadHierarchy: 'firm',    // ADR-082 — flat | soft | firm | strong | extreme
    coastLine: false,         // ADR-089 — extra line on water/land edge
    parkSoften: false,        // ADR-092 — blurred halo around park polygons
    buildingShadow: 'none',   // ADR-093 — none | subtle | lifted (CSS drop-shadow)
    mapPadding: 'none',       // ADR-086 — none | cozy | breathing | loose
    captionCompact: false,    // ADR-087 — force caption to <12% (vs default 18%)
    edgeFade: false,          // ADR-094 — soft mask-image fade on map edges
    monotone: false,          // ADR-090 — derive every palette colour from bg
    centerRoundel: false,     // ADR-095 — explicit dot at state.view.center
    autoLegend: false,        // ADR-096 — small SVG legend in bottom-left
    cmykPreview: false,       // ADR-100 — CSS approximation of CMYK gamut shift
    typographyPreset: 'default', // ADR-098 — default|editorial|modern|vintage|brutalist|quiet
    // ADR-079 — Background pattern under the poster, behind the map.
    // Pure CSS — applied via .bg-{value} class on #poster.
    bgPattern: 'none',        // none | rings | stripes | dotgrid | isobars
    // ADR-073 — show trim guides in the live preview when bleed export is on.
    showTrimGuides: false,
    // ADR-066 — disable scroll-zoom while panning so the user can fine-tune
    // composition without accidental zoom drift.
    scaleLocked: false,
    // ===== ADR-141..160: caption-block variants =====
    captionLayout: 'block',     // ADR-141 — block / overlay / banner / stamp / monogram / hidden / vertical-left / vertical-right / cover
    captionPos: 'bc',           // ADR-142 — overlay position 9-grid (tl|tc|tr|ml|mc|mr|bl|bc|br)
    captionBgOpacity: 100,      // ADR-143 — block bg alpha 0..100
    captionPadding: 'cozy',     // ADR-159 — flush | cozy | breathing | loose
    captionAutoContrast: false, // ADR-144 — sample map luminance, flip text colour
    captionBackdropBlur: false, // ADR-145 — frosted-glass behind text
    titleOnly: false,           // ADR-146 — hide subtitle/coords/tagline
    titleOutline: false,        // ADR-148 — stroke-only title text
    captionTextShadow: false,   // ADR-149 — drop shadow for overlay legibility
    titleAutoFit: false,        // ADR-150 — title scales to fit available width
    titleGradient: false,       // ADR-157 — gradient fill on title
    titleWordSpace: false,      // ADR-158 — per-word kerning for multi-word titles
    captionPreset: 'classic',   // ADR-160 — atomic preset of all the above
    mapMask: 'none',          // none | circle | hexagon | heart | star | rounded
    sketchFrame: false,       // wobbly hand-drawn SVG overlay frame
    watermark: '',            // user-typed line shown in caption corner
    // (confetti has no state — fires once per randomize/export)
    titleWeight: 'bold',
    titleSize: 'medium',
    subtitleStyle: 'regular',
    coordsStyle: 'decimal',
    caption: { title: 'PARIS', subtitle: 'The City of Light', tagline: '', anniversary: false, date: '' },
    view: { center: [2.3522, 48.8566], zoom: 12 },
    seed: '',
    // Photoshop-style filter stack: each entry is one full-bleed overlay
    // composited over the map via mix-blend-mode. See js/filters.js.
    // Shape: { id, enabled, type, blend, opacity, color?, from?, to?, angle?, inner?, outer?, dataUrl? }
    filters: [],
  };
}

// TEMPLATE_FIELDS lives in DATA — to expose a new dial as a template-level
// field, append the key to data.js.

function clonePreset(key) {
  const p = PRESETS[key];
  const palette = { ...p.palette };
  // Roof color defaults to walls when a preset doesn't specify one
  if (!palette.roof) palette.roof = palette.building;
  const layers = { roads: true, boundaries: true, ...p.layers };
  // Migrate legacy `places: true|false` → split cities + neighborhoods
  if ('places' in layers) {
    if (!('cities' in layers))        layers.cities = layers.places;
    if (!('neighborhoods' in layers)) layers.neighborhoods = layers.places;
    delete layers.places;
  }
  const clone = {
    palette,
    layers,
    roadWeight: p.roadWeight,
    roadStyle: p.roadStyle,
    labelFont: p.labelFont,
  };
  TEMPLATE_FIELDS.forEach(k => { if (k in p) clone[k] = p[k]; });
  return clone;
}

let state = defaultState();
let gpxData = null; // GeoJSON LineString, kept in memory + localStorage

// =====================================================================
// ADR-016: Undo/redo
// =====================================================================
const history = { past: [], future: [] };
const HISTORY_CAP = 30;
let historyTimer;

function snapshot() {
  return JSON.parse(JSON.stringify(state));
}
function pushHistory() {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(() => {
    history.past.push(snapshot());
    if (history.past.length > HISTORY_CAP) history.past.shift();
    history.future = [];
  }, 220);
}
function undo() {
  if (!history.past.length) return;
  history.future.push(snapshot());
  state = history.past.pop();
  applyState({ silent: true });
}
function redo() {
  if (!history.future.length) return;
  history.past.push(snapshot());
  state = history.future.pop();
  applyState({ silent: true });
}

// =====================================================================
// ADR-001 + 002: Persistence (URL hash + localStorage)
// =====================================================================
const LS_KEY = 'osm-poster:last';
const LS_GPX = 'osm-poster:gpx';
const LS_VISITED = 'osm-poster:visited';

function encodeState() {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(state)))); }
  catch (e) { return ''; }
}
function decodeState(hash) {
  try { return JSON.parse(decodeURIComponent(escape(atob(hash)))); }
  catch (e) { return null; }
}
let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const enc = encodeState();
    if (enc) {
      try { window.history.replaceState(null, '', '#' + enc); } catch (e) { location.hash = enc; }
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    }
    // ADR-112 — Auto-save tick: small "Saved at HH:MM" indicator in the
    // footer so users know their work is sticking. Updated only after
    // the throttled save actually runs (not on every keystroke), so the
    // timestamp reflects the real save event.
    try {
      const tick = document.getElementById('autoSaveTick');
      if (tick) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        tick.textContent = `✓ Saved ${hh}:${mm}`;
        tick.classList.add('flash');
        setTimeout(() => tick.classList.remove('flash'), 500);
      }
    } catch (_) {}
  }, 250);
}
function loadFromUrlOrStorage() {
  if (location.hash.length > 1) {
    const decoded = decodeState(location.hash.slice(1));
    if (decoded) return decoded;
  }
  try {
    const ls = localStorage.getItem(LS_KEY);
    if (ls) return JSON.parse(ls);
  } catch (e) {}
  return null;
}

// COLOR HELPERS (darken, lighten, lum, haloFor) and dashFor live in LIB
// (./js/lib.js) and are destructured at the top of this script.

