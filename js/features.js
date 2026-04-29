// =====================================================================
// OSM Poster — feature wiring
// Hash-change, init/boot, time-of-day tint, click-placed annotations,
// polaroid pins, auto-subtitle chips, custom-font upload, edition serial,
// city outline overlay, POI declustering wrap. Each section is gated by
// its own ADR comment.
// =====================================================================

// =====================================================================
// HASH-CHANGE LISTENER (when user pastes a shared URL)
// =====================================================================
window.addEventListener('hashchange', () => {
  if (location.hash.length > 1) {
    const decoded = decodeState(location.hash.slice(1));
    if (decoded) {
      state = mergeState(decoded);
      applyState({ silent: true });
      if (state.view) map.jumpTo({ center: state.view.center, zoom: state.view.zoom, bearing: state.bearing || 0, pitch: state.pitch || 0 });
    }
  }
});

// =====================================================================
// INIT
// =====================================================================
// =====================================================================
// ADR-022 — Image-to-palette eyedropper
// =====================================================================
async function extractPaletteFromImage(file) {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = URL.createObjectURL(file); });
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, 64, 64);
  const data = ctx.getImageData(0, 0, 64, 64).data;
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] < 128) continue; // skip transparent
    const r = data[i] >> 5 << 5, g = data[i+1] >> 5 << 5, b = data[i+2] >> 5 << 5;
    const k = `${r},${g},${b}`;
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }
  const top = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const cols = top.map(([k]) => {
    const [r, g, b] = k.split(',').map(Number);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  });
  cols.sort((a, b) => lum(a) - lum(b));
  const pick = i => cols[Math.min(i, cols.length - 1)] || '#888888';
  return {
    bg:       pick(1),
    water:    pick(3),
    green:    pick(4),
    urban:    pick(5),
    building: pick(6),
    road:     pick(cols.length - 1),  // brightest
    rail:     pick(8),
    label:    pick(cols.length - 1),
    accent:   pick(cols.length - 2),
  };
}
const paletteFile = document.getElementById('paletteFile');
if (paletteFile) paletteFile.addEventListener('change', safe(async e => {
  const f = e.target.files[0]; if (!f) return;
  Loader.push();
  try {
    const pal = await extractPaletteFromImage(f);
    pushHistory();
    state.palette = { ...state.palette, ...pal };
    applyState();
  } finally { Loader.pop(); e.target.value = ''; }
}, 'imagePalette'));

// =====================================================================
// ADR-023 — Time-of-day atmospheric tint
// =====================================================================
function applyTOD() {
  const w = document.getElementById('map-wrap');
  ['dawn','day','golden','dusk','night'].forEach(c => w.classList.remove('tod-' + c));
  let tod = state.tod || 'none';
  if (tod === 'auto') {
    const lng = (state.view && state.view.center && state.view.center[0]) || 0;
    const date = new Date();
    const hour = ((date.getUTCHours() + (lng / 15)) % 24 + 24) % 24;
    if      (hour >= 5  && hour < 7 ) tod = 'dawn';
    else if (hour >= 7  && hour < 17) tod = 'day';
    else if (hour >= 17 && hour < 19) tod = 'golden';
    else if (hour >= 19 && hour < 21) tod = 'dusk';
    else                              tod = 'night';
  }
  if (tod && tod !== 'none' && tod !== 'day') w.classList.add('tod-' + tod);
  const sel = document.getElementById('todTint');
  if (sel) sel.value = state.tod || 'none';
}
const todTintEl = document.getElementById('todTint');
if (todTintEl) todTintEl.addEventListener('change', safe(e => {
  pushHistory(); state.tod = e.target.value; applyTOD(); persist();
}, 'todTint'));

// =====================================================================
// ADR-024 — Click-placed annotations
// =====================================================================
let placeMode = null;
let pendingPolaroid = null;
function setPlaceMode(m) {
  placeMode = m;
  const mEl = document.getElementById('map');
  if (mEl) mEl.classList.toggle('place-mode', !!m);
}

let annotationMarkers = [];
function clearAnnotationMarkers() {
  annotationMarkers.forEach(m => { try { m.remove(); } catch (_) {} });
  annotationMarkers = [];
}
function renderAnnotations() {
  clearAnnotationMarkers();
  (state.annotations || []).forEach((a, idx) => {
    const el = document.createElement('div');
    el.className = 'annotation-marker';
    el.style.color = state.palette.accent || '#007aff';
    el.textContent = a.text;
    el.title = 'Click to remove';
    el.addEventListener('click', () => {
      pushHistory(); state.annotations.splice(idx, 1); renderAnnotations(); persist();
    });
    const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([a.lng, a.lat]).addTo(map);
    annotationMarkers.push(mk);
  });
  const s = document.getElementById('annotationStatus');
  if (s) s.textContent = (state.annotations || []).length ? `${state.annotations.length} placed (click any to remove)` : '';
}
const addAnnBtn = document.getElementById('addAnnotationBtn');
if (addAnnBtn) addAnnBtn.addEventListener('click', () => {
  setPlaceMode('annotation');
  const s = document.getElementById('annotationStatus');
  if (s) s.textContent = 'Click on the map to place… (Esc to cancel)';
});
const clearAnnBtn = document.getElementById('clearAnnotationsBtn');
if (clearAnnBtn) clearAnnBtn.addEventListener('click', () => {
  pushHistory(); state.annotations = []; renderAnnotations(); persist();
});

// =====================================================================
// ADR-028 — Photo polaroid pinned at lat/lng
// =====================================================================
let polaroidMarkers = [];
function clearPolaroidMarkers() {
  polaroidMarkers.forEach(m => { try { m.remove(); } catch (_) {} });
  polaroidMarkers = [];
}
function renderPolaroids() {
  clearPolaroidMarkers();
  (state.polaroids || []).forEach((p, idx) => {
    // Backfill a random rotation for older polaroids that pre-date the
    // rot field (or had it set to 0 by accident).
    if (typeof p.rot !== 'number' || p.rot === 0) p.rot = -8 + Math.random() * 16;
    const outer = document.createElement('div');
    outer.className = 'polaroid';
    const safeCap = (p.caption || '').replace(/[<>"']/g, '');
    outer.innerHTML = `
      <div class="polaroid-inner" style="transform: rotate(${p.rot}deg); --rot: ${p.rot}deg;">
        <img src="${p.dataUrl}" alt="">
        <div class="pcap">${safeCap}</div>
        <div class="px" title="Remove">×</div>
      </div>
    `;
    outer.querySelector('.px').addEventListener('click', e => {
      e.stopPropagation();
      pushHistory(); state.polaroids.splice(idx, 1); renderPolaroids(); persist();
    });
    const mk = new maplibregl.Marker({ element: outer, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(map);
    polaroidMarkers.push(mk);
  });
  const s = document.getElementById('polaroidStatus');
  if (s) s.textContent = (state.polaroids || []).length ? `${state.polaroids.length} pinned` : '';
}
const polaroidFileEl = document.getElementById('polaroidFile');
if (polaroidFileEl) polaroidFileEl.addEventListener('change', safe(async e => {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    pendingPolaroid = reader.result;
    setPlaceMode('polaroid');
    const s = document.getElementById('polaroidStatus');
    if (s) s.textContent = 'Click on the map to drop the photo… (Esc to cancel)';
  };
  reader.readAsDataURL(f);
  e.target.value = '';
}, 'polaroidUpload'));
const clearPolBtn = document.getElementById('clearPolaroidsBtn');
if (clearPolBtn) clearPolBtn.addEventListener('click', () => {
  pushHistory(); state.polaroids = []; renderPolaroids(); persist();
});

// Map click: dispatch on placeMode (annotation or polaroid)
map.on('click', e => {
  if (!placeMode) return;
  const { lng, lat } = e.lngLat;
  if (placeMode === 'annotation') {
    setPlaceMode(null);
    const text = prompt('Annotation text:');
    if (!text) return;
    pushHistory();
    if (!Array.isArray(state.annotations)) state.annotations = [];
    state.annotations.push({ lng, lat, text });
    renderAnnotations(); persist();
  } else if (placeMode === 'polaroid' && pendingPolaroid) {
    const caption = prompt('Caption (optional):') || '';
    pushHistory();
    if (!Array.isArray(state.polaroids)) state.polaroids = [];
    state.polaroids.push({ lng, lat, dataUrl: pendingPolaroid, caption, rot: -4 + Math.random() * 8 });
    pendingPolaroid = null;
    setPlaceMode(null);
    renderPolaroids(); persist();
  }
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && placeMode) { setPlaceMode(null); pendingPolaroid = null; }
});

// =====================================================================
// ADR-025 — Auto-subtitle suggestions
// =====================================================================
function buildSubtitleChips(place) {
  const chips = [];
  const parts = (place.display_name || '').split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) chips.push(parts[parts.length - 1]);          // country
  if (parts.length >= 3) chips.push(parts.slice(-2).join(', '));       // region, country
  if (place.type && place.class) chips.push(`A ${place.type.replace(/_/g, ' ')} in ${parts[parts.length - 1] || 'the world'}`);
  const lat = parseFloat(place.lat), lon = parseFloat(place.lon);
  if (!isNaN(lat) && !isNaN(lon)) {
    chips.push(`${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`);
  }
  return chips.slice(0, 4);
}
function renderSubtitleChips(chips) {
  const c = document.getElementById('subtitleChips');
  if (!c) return;
  c.innerHTML = '';
  chips.forEach(text => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'subtitle-chip'; b.textContent = text;
    b.addEventListener('click', () => {
      pushHistory();
      state.caption.subtitle = text;
      const sub = document.getElementById('subtitle');
      if (sub) sub.value = text;
      const cs = document.getElementById('caption-subtitle');
      if (cs) cs.textContent = text;
      persist();
    });
    c.appendChild(b);
  });
}

// =====================================================================
// ADR-027 — Custom font upload
// =====================================================================
function applyCustomFont() {
  const cap = document.getElementById('caption');
  if (!cap) return;
  cap.classList.toggle('custom-font', !!state.customFontOn);
  const status = document.getElementById('fontStatus');
  if (status) {
    status.innerHTML = state.customFontName
      ? `Using <b>${state.customFontName}</b> — <span class="clear" id="fontClear">remove</span>`
      : '';
    const clear = document.getElementById('fontClear');
    if (clear) clear.addEventListener('click', () => {
      pushHistory();
      state.customFontOn = false; state.customFontName = null;
      try { localStorage.removeItem('osm-poster:font'); } catch (_) {}
      applyCustomFont(); persist();
    });
  }
}
async function loadCustomFont(file) {
  const buf = await file.arrayBuffer();
  const face = new FontFace('OSMPosterCustom', buf);
  await face.load();
  document.fonts.add(face);
  state.customFontOn = true;
  state.customFontName = file.name;
  if (buf.byteLength <= 1024 * 1024) {
    const arr = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < arr.length; i += 8192) {
      bin += String.fromCharCode.apply(null, arr.subarray(i, i + 8192));
    }
    try { localStorage.setItem('osm-poster:font', JSON.stringify({ name: file.name, data: btoa(bin) })); } catch (_) {}
  }
  applyCustomFont(); persist();
}
const fontFileEl = document.getElementById('fontFile');
if (fontFileEl) fontFileEl.addEventListener('change', safe(async e => {
  const f = e.target.files[0]; if (!f) return;
  Loader.push();
  try { await loadCustomFont(f); } finally { Loader.pop(); e.target.value = ''; }
}, 'customFont'));
(async function restoreCustomFont() {
  try {
    const s = localStorage.getItem('osm-poster:font');
    if (!s) return;
    const { name, data } = JSON.parse(s);
    const bin = atob(data);
    const buf = new ArrayBuffer(bin.length);
    const arr = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const face = new FontFace('OSMPosterCustom', buf);
    await face.load();
    document.fonts.add(face);
    state.customFontName = name;
    if (state.customFontOn) applyCustomFont();
  } catch (_) {}
})();

// =====================================================================
// ADR-029 — Edition serial number
// =====================================================================
function nextEdition() {
  const cur = parseInt(localStorage.getItem('osm-poster:edition') || '0', 10) || 0;
  const next = cur + 1;
  try { localStorage.setItem('osm-poster:edition', String(next)); } catch (_) {}
  return next;
}
function formatEdition(n) {
  return '№ ' + n.toString(36).toUpperCase().padStart(3, '0') + ' · ∞';
}
function setEditionDisplay(n) {
  const el = document.getElementById('captionEdition');
  if (el) el.textContent = formatEdition(n);
}
// Show the current (last-issued) edition on screen so the user always
// sees a serial; bumps fresh on each export.
let _seenEd = 1;
try { _seenEd = parseInt(localStorage.getItem('osm-poster:edition') || '0', 10) || 1; } catch (_) {}
setEditionDisplay(_seenEd);

// =====================================================================
// ADR-031 — City outline polygon highlight
// =====================================================================
async function fetchCityOutline(query) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&limit=1&q=${encodeURIComponent(query)}`);
  if (!r.ok) return null;
  const items = await r.json();
  return (items && items[0] && items[0].geojson) ? { type: 'Feature', properties: {}, geometry: items[0].geojson } : null;
}
function ensureCityOutline() {
  // City outline is a foreground stroke — render it on the fg map so it
  // sits above buildings and is unaffected by bg-targeted filters.
  const layerId = 'city-outline-line';
  if (state.cityOutlineGeo) {
    if (mapFg.getSource('cityOutline')) mapFg.getSource('cityOutline').setData(state.cityOutlineGeo);
    else mapFg.addSource('cityOutline', { type: 'geojson', data: state.cityOutlineGeo });
    if (!mapFg.getLayer(layerId)) {
      mapFg.addLayer({
        id: layerId, type: 'line', source: 'cityOutline',
        paint: {
          'line-color': state.palette.accent || '#007aff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 3],
          'line-opacity': 0.65, 'line-blur': 1,
        },
      });
    } else {
      mapFg.setPaintProperty(layerId, 'line-color', state.palette.accent || '#007aff');
    }
    mapFg.setLayoutProperty(layerId, 'visibility', state.cityOutline ? 'visible' : 'none');
  }
}
const cityOutlineCb = document.getElementById('cityOutlineToggle');
if (cityOutlineCb) cityOutlineCb.addEventListener('change', safe(e => {
  pushHistory(); state.cityOutline = e.target.checked; ensureCityOutline(); persist();
}, 'cityOutlineToggle'));

// Hook place selection: subtitle chips + city polygon. Run on every
// search result click and every Quick city button click.
async function onPlacePicked(item) {
  // Subtitle chips
  renderSubtitleChips(buildSubtitleChips(item));
  // City outline polygon (cached for the current pick)
  try {
    const geo = await fetchCityOutline(item.display_name || item.name || '');
    state.cityOutlineGeo = geo;
    ensureCityOutline();
  } catch (_) {}
  persist();
}

// =====================================================================
// ADR-030 — POI proximity declustering (simple variant)
// Markers within 36 px of an already-placed marker on screen are skipped.
// Implemented by hooking into refreshPOIs through a wrapper guard.
// =====================================================================
const _origRefreshPOIs = refreshPOIs;
let _picksScratch = [];
// We extend the marker-creation phase: after refreshPOIs runs, deduplicate
// by screen distance among existing markers.
const observeProximity = () => {
  if (!poiMarkers.length) return;
  const seen = [];
  const toRemove = [];
  poiMarkers.forEach(m => {
    const ll = m.getLngLat();
    const sc = map.project([ll.lng, ll.lat]);
    if (seen.some(p => { const dx = p.x - sc.x, dy = p.y - sc.y; return dx*dx + dy*dy < 36*36; })) {
      toRemove.push(m);
    } else {
      seen.push(sc);
    }
  });
  toRemove.forEach(m => { try { m.remove(); } catch(_){} });
  poiMarkers = poiMarkers.filter(m => !toRemove.includes(m));
};
map.on('idle', () => { try { observeProximity(); } catch (_) {} });
