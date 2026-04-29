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
    },
    // ADR-023 atmospheric tint: none | auto | dawn | day | golden | dusk | night
    tod: 'none',
    // ADR-031 city polygon outline
    cityOutline: false,
    cityOutlineGeo: null,   // cached GeoJSON (filled on place selection)
    // ADR-026 print bleed in PDF export
    exportBleed: false,
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
    mapMask: 'none',          // none | circle | hexagon | heart | star | rounded
    sketchFrame: false,       // wobbly hand-drawn SVG overlay frame
    watermark: '',            // user-typed line shown in caption corner
    // (confetti has no state — fires once per randomize/export)
    titleWeight: 'bold',
    titleSize: 'medium',
    subtitleStyle: 'regular',
    coordsStyle: 'decimal',
    caption: { title: 'PARIS', subtitle: 'The City of Light', anniversary: false, date: '' },
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

