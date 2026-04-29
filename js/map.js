// =====================================================================
// OSM Poster — MapLibre instance + GPX overlay
// Thin wrapper around STYLE.build() (the real style generator lives in
// js/style.js), the actual map.new MapLibre instance, mergeState() to
// rehydrate from a URL hash payload, plus ADR-009 GPX track parsing.
// =====================================================================

// =====================================================================
// STYLE GENERATOR
// =====================================================================
// Thin wrapper — the real buildStyle lives in ./js/style.js.
// Adding a new layer renderer = edit STYLE.build there + the layer key
// in DATA.LAYER_ORDER / LAYER_LABELS / LAYER_GROUPS.
//
// Each of the 3 stacked MapLibre instances gets a partial style for its
// own layer group (bg / buildings / fg). The primary also gets the
// canvas background-color via the 'bg' layer; the overlays render on a
// transparent canvas and stack via CSS.
function buildStyle(s, group) {
  return STYLE.build(s, PRESETS.blueprint.palette, { group });
}

// =====================================================================
// MAP
// =====================================================================
function mergeState(saved) {
  const def = defaultState();
  if (!saved || typeof saved !== 'object') return def;
  const savedIcons = saved.icons || {};
  const merged = {
    ...def, ...saved,
    palette: { ...def.palette, ...(saved.palette || {}) },
    layers:  { ...def.layers,  ...(saved.layers  || {}) },
    icons:   {
      ...def.icons,
      ...savedIcons,
      categories: { ...def.icons.categories, ...(savedIcons.categories || {}) },
    },
    caption: { ...def.caption, ...(saved.caption || {}) },
    view:    { ...def.view,    ...(saved.view    || {}) },
    annotations: Array.isArray(saved.annotations) ? saved.annotations : def.annotations,
    polaroids:   Array.isArray(saved.polaroids)   ? saved.polaroids   : def.polaroids,
  };
  // Migrate legacy 'places' → cities + neighborhoods
  if ('places' in merged.layers) {
    if (!('cities' in merged.layers))        merged.layers.cities = merged.layers.places;
    if (!('neighborhoods' in merged.layers)) merged.layers.neighborhoods = merged.layers.places;
    delete merged.layers.places;
  }
  // Roof color defaults to walls when missing (older saved states)
  if (!merged.palette.roof) merged.palette.roof = merged.palette.building;
  return merged;
}
const initialState = loadFromUrlOrStorage();
if (initialState) state = mergeState(initialState);

// Cap concurrent image requests so a fast zoom doesn't spawn 60+
// in-flight PBF fetches that get cancelled when the user keeps scrolling.
if (maplibregl.config) maplibregl.config.MAX_PARALLEL_IMAGE_REQUESTS = 8;

const map = new maplibregl.Map({
  container: 'map',
  style: buildStyle(state, 'bg'),
  center: state.view.center,
  zoom: state.view.zoom,
  bearing: state.bearing,
  pitch: state.pitch,
  attributionControl: { compact: true },
  preserveDrawingBuffer: true,
  // Keep more tiles in memory so zoom-back doesn't re-fetch.
  maxTileCacheSize: 256,
  // Snappier transitions reduce the perceived "many tiles loading" effect.
  fadeDuration: 100,
});

// ---- Per-layer-group overlay maps -----------------------------------
// Two extra MapLibre instances stacked above the primary, each rendering
// only its own group's layers (buildings / foreground). They have no
// background fill, no controls, and no pointer events — the primary owns
// the camera and we replicate every move via jumpTo() (cheap enough that
// it keeps up during interactive pans). attributionControl: false so we
// don't get duplicated OSM credits.
const _commonOverlayOpts = {
  interactive: false,
  attributionControl: false,
  preserveDrawingBuffer: true,
  maxTileCacheSize: 256,
  fadeDuration: 100,
};
const mapBuildings = new maplibregl.Map({
  container: 'map-buildings',
  style: buildStyle(state, 'buildings'),
  center: state.view.center,
  zoom: state.view.zoom,
  bearing: state.bearing,
  pitch: state.pitch,
  ..._commonOverlayOpts,
});
const mapFg = new maplibregl.Map({
  container: 'map-fg',
  style: buildStyle(state, 'fg'),
  center: state.view.center,
  zoom: state.view.zoom,
  bearing: state.bearing,
  pitch: state.pitch,
  ..._commonOverlayOpts,
});

// Convenience: every helper that wants to touch all three.
const MAPS_ALL = [map, mapBuildings, mapFg];

// Camera sync — the primary fires 'move' continuously during user
// interaction; we propagate to the overlays via jumpTo so they paint the
// next frame from the same camera. jumpTo doesn't fire its own 'move'
// loop on the overlay (no animation), so we don't get feedback storms.
function _syncCameraToOverlays() {
  const c = map.getCenter();
  const z = map.getZoom();
  const b = map.getBearing();
  const p = map.getPitch();
  mapBuildings.jumpTo({ center: [c.lng, c.lat], zoom: z, bearing: b, pitch: p });
  mapFg.jumpTo({ center: [c.lng, c.lat], zoom: z, bearing: b, pitch: p });
}
map.on('move', _syncCameraToOverlays);
// Belt-and-suspenders: also sync on the resize the primary triggers
// when the container changes size (e.g. frame aspect change).
map.on('resize', () => {
  mapBuildings.resize();
  mapFg.resize();
  _syncCameraToOverlays();
});

// Loader hooks — show the line while tiles are in flight.
map.on('dataloading', () => Loader.push());
map.on('data',        e => { if (e.dataType === 'source' && e.isSourceLoaded) Loader.pop(); });
map.on('idle',        () => Loader.reset());

// POI overlay refresh on view changes (now that `map` exists)
map.on('moveend', refreshPOIs);
map.on('idle', refreshPOIs);

// Slow the scroll-wheel zoom rate so each tick is more deliberate.
// Default fires fractional zoom changes per wheel event — this lets a
// single zoom level settle before MapLibre starts fetching the next.
if (map.scrollZoom && map.scrollZoom.setWheelZoomRate) {
  map.scrollZoom.setWheelZoomRate(1/250);
}

// On zoom end, snap to the nearest 0.5 zoom step. Cuts the "fractional
// zoom that fetched tiles for two adjacent levels" waste in half.
let snapTimer;
map.on('zoomend', () => {
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => {
    const z = map.getZoom();
    const snapped = Math.round(z * 2) / 2;
    if (Math.abs(z - snapped) > 0.02) {
      map.easeTo({ zoom: snapped, duration: 150 });
    }
  }, 80);
});

const scaleControl = new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' });

map.on('move', () => {
  const c = map.getCenter();
  document.getElementById('caption-coords').textContent = formatCoords(c.lat, c.lng);
  state.view.center = [c.lng, c.lat];
  state.view.zoom = map.getZoom();
  state.bearing = map.getBearing();
  state.pitch = map.getPitch();
  bearingInput.value = Math.round(state.bearing);
  bearingVal.textContent = Math.round(state.bearing) + '°';
  pitchInput.value = Math.round(state.pitch);
  pitchVal.textContent = Math.round(state.pitch) + '°';
  persist();
});

// Thin wrapper — picks DMS or decimal based on state.coordsStyle.
// Both formatters live in LIB so this stays trivially small.
function formatCoords(lat, lng) {
  if (state.coordsStyle === 'dms') return dms(lat, true) + ' · ' + dms(lng, false);
  return formatDecimalCoords(lat, lng);
}

function applyTypography() {
  const t = document.getElementById('caption-title');
  if (t) {
    ['tw-regular','tw-medium','tw-bold','tw-heavy','ts-small','ts-medium','ts-large','ts-xl'].forEach(c => t.classList.remove(c));
    t.classList.add('tw-' + (state.titleWeight || 'bold'));
    t.classList.add('ts-' + (state.titleSize || 'medium'));
  }
  const sub = document.getElementById('caption-subtitle');
  if (sub) {
    ['ss-regular','ss-italic','ss-hidden'].forEach(c => sub.classList.remove(c));
    sub.classList.add('ss-' + (state.subtitleStyle || 'regular'));
  }
  const co = document.getElementById('caption-coords');
  if (co) {
    co.classList.toggle('cs-hidden', state.coordsStyle === 'hidden');
  }
}

let restyleTimer;
function restyle() {
  clearTimeout(restyleTimer);
  restyleTimer = setTimeout(() => {
    const c = map.getCenter(), z = map.getZoom(), b = map.getBearing(), pi = map.getPitch();
    map.setStyle(buildStyle(state, 'bg'));
    mapBuildings.setStyle(buildStyle(state, 'buildings'));
    mapFg.setStyle(buildStyle(state, 'fg'));
    map.once('style.load', () => {
      map.jumpTo({ center: c, zoom: z, bearing: b, pitch: pi });
      _syncCameraToOverlays();
      // GPX + city-outline are foreground annotations — they live on the
      // fg map's runtime layers (added after setStyle clears them).
      mapFg.once('style.load', () => {
        ensureGpx();
        try { ensureCityOutline(); } catch (_) {}
      });
    });
  }, 80);
}

// =====================================================================
// ADR-009: GPX overlay
// =====================================================================
function parseGpx(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  const pts = [...xml.querySelectorAll('trkpt, rtept, wpt')]
    .map(p => [parseFloat(p.getAttribute('lon')), parseFloat(p.getAttribute('lat'))])
    .filter(p => !isNaN(p[0]) && !isNaN(p[1]));
  if (pts.length < 2) return null;
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } };
}
function ensureGpx() {
  // GPX track is a foreground line — lives on the fg map so it composites
  // above buildings + the foreground filter slot (where the user might
  // want to blend roads/labels but leave the imported track sharp).
  if (!gpxData) return;
  if (mapFg.getLayer('gpx-line')) mapFg.removeLayer('gpx-line');
  if (mapFg.getSource('gpx')) mapFg.removeSource('gpx');
  mapFg.addSource('gpx', { type: 'geojson', data: gpxData });
  mapFg.addLayer({
    id: 'gpx-line', type: 'line', source: 'gpx',
    paint: { 'line-color': state.palette.accent, 'line-width': 4, 'line-opacity': 0.92 },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  });
}
function loadGpx(geojson, fitBounds = true) {
  gpxData = geojson;
  ensureGpx();
  if (fitBounds && geojson) {
    const coords = geojson.geometry.coordinates;
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    coords.forEach(([x, y]) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); });
    map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 50 });
  }
  try {
    if (geojson) localStorage.setItem(LS_GPX, JSON.stringify(geojson));
    else localStorage.removeItem(LS_GPX);
  } catch (e) {}
  updateGpxStatus();
}
function updateGpxStatus() {
  const el = document.getElementById('gpxStatus');
  if (gpxData) el.innerHTML = `Route loaded: ${gpxData.geometry.coordinates.length} points · <span class="clear" id="gpxClear">remove</span>`;
  else el.innerHTML = '';
  const clear = document.getElementById('gpxClear');
  if (clear) clear.addEventListener('click', () => loadGpx(null, false));
}
try {
  const saved = localStorage.getItem(LS_GPX);
  if (saved) gpxData = JSON.parse(saved);
} catch (e) {}

// (Center-marker code removed; POI icon overlay covers all marker needs.)

// ADR-019 PRNG (mulberry32, seedToInt) and hsl() live in LIB.

function randomizePalette() {
  const rng = mulberry32(seedToInt(state.seed));
  const baseHue = Math.floor(rng() * 360);
  const dark = rng() > 0.5;
  const sat = 30 + rng() * 50;
  state.palette = {
    bg:       dark ? hsl(baseHue, sat * 0.6, 8 + rng() * 6) : hsl(baseHue, sat * 0.3, 92 + rng() * 4),
    water:    dark ? hsl((baseHue + 200) % 360, sat * 0.7, 15 + rng() * 8) : hsl((baseHue + 200) % 360, sat * 0.6, 75 + rng() * 8),
    green:    dark ? hsl((baseHue + 100) % 360, sat * 0.5, 12 + rng() * 6) : hsl((baseHue + 100) % 360, sat * 0.5, 78 + rng() * 8),
    urban:    dark ? hsl(baseHue, sat * 0.4, 14 + rng() * 5) : hsl(baseHue, sat * 0.3, 88 + rng() * 4),
    building: dark ? hsl(baseHue, sat * 0.4, 18 + rng() * 6) : hsl(baseHue, sat * 0.3, 84 + rng() * 6),
    road:     dark ? hsl((baseHue + 30) % 360, sat, 65 + rng() * 25) : hsl((baseHue + 30) % 360, sat, 25 + rng() * 20),
    rail:     dark ? hsl((baseHue + 60) % 360, sat * 0.7, 55) : hsl((baseHue + 60) % 360, sat * 0.7, 35),
    label:    dark ? hsl((baseHue + 60) % 360, sat * 0.6, 80) : hsl((baseHue + 60) % 360, sat * 0.7, 22),
    accent:   hsl((baseHue + 180) % 360, sat * 0.9, dark ? 65 : 45),
  };
}
