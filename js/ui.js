// =====================================================================
// OSM Poster — sidebar UI wiring
// Renders templates / presets / palette / layer toggles / chips / sliders
// and translates user input into state mutations + map repaints.
// =====================================================================

// =====================================================================
// UI WIRING
// =====================================================================
const TEMPLATE_KEYS = PRESET_KEYS.filter(k => PRESETS[k].isTemplate);
const PALETTE_KEYS_LIST = PRESET_KEYS.filter(k => !PRESETS[k].isTemplate);

// TEMPLATE_BLURBS lives in ./js/presets.js
const TEMPLATE_BLURBS = PRESET_DATA.TEMPLATE_BLURBS;


const templatesEl = document.getElementById('templates');
TEMPLATE_KEYS.forEach(key => {
  const p = PRESETS[key];
  const card = document.createElement('div');
  card.className = 'template' + (key === state.preset ? ' active' : '');
  card.dataset.key = key;
  card.innerHTML = `
    <div class="template-preview" style="--tpl-bg:${p.palette.bg}; --tpl-road:${p.palette.road}; --tpl-water:${p.palette.water}; --tpl-accent:${p.palette.accent}"></div>
    <div class="template-info">
      <div class="template-name">${p.name}</div>
      <div class="template-desc">${TEMPLATE_BLURBS[key] || ''}</div>
    </div>
  `;
  card.addEventListener('click', safe(() => selectPreset(key), 'selectTemplate'));
  templatesEl.appendChild(card);
});

const presetsEl = document.getElementById('presets');
PALETTE_KEYS_LIST.forEach((key) => {
  const p = PRESETS[key];
  const div = document.createElement('div');
  div.className = 'preset' + (key === state.preset ? ' active' : '');
  div.dataset.key = key;
  div.innerHTML = `<div class="swatch"><span style="background:${p.palette.bg}"></span><span style="background:${p.palette.water}"></span><span style="background:${p.palette.road}"></span></div><div class="label">${p.name}</div>`;
  div.addEventListener('click', safe(() => selectPreset(key), 'selectPreset'));
  presetsEl.appendChild(div);
});

function selectPreset(key) {
  pushHistory();
  state.preset = key;
  Object.assign(state, clonePreset(key));
  applyState();
}
function cyclePreset(dir) {
  const i = PRESET_KEYS.indexOf(state.preset);
  const next = PRESET_KEYS[(i + dir + PRESET_KEYS.length) % PRESET_KEYS.length];
  selectPreset(next);
}
// ADR-067 — "Cycle templates" button. Walks ONLY the full templates
// (skipping plain palette presets) so each click is a meaningful
// look-change, not a tiny color shift. Same code path as the [/]
// keyboard shortcuts but constrained to the template subset.
function cycleTemplate(dir) {
  const tplKeys = PRESET_KEYS.filter(k => PRESETS[k].isTemplate);
  if (!tplKeys.length) return;
  const i = tplKeys.indexOf(state.preset);
  // If currently on a non-template preset, start at the beginning.
  const next = i < 0 ? tplKeys[0] : tplKeys[(i + (dir || 1) + tplKeys.length) % tplKeys.length];
  selectPreset(next);
}
bindEl('cycleTemplatesBtn', 'click', safe(() => cycleTemplate(1), 'cycleTemplate'));

const citiesEl = document.getElementById('cities');
CITIES.forEach(c => {
  const b = document.createElement('button');
  b.textContent = c.name;
  b.addEventListener('click', () => {
    pushHistory();
    map.flyTo({ center: c.coord, zoom: c.zoom, bearing: state.bearing, pitch: state.pitch });
    state.caption.title = c.name;
    document.getElementById('caption-title').textContent = c.name;
    document.getElementById('title').value = c.name;
    persist();
    onPlacePicked({ display_name: c.name, lat: c.coord[1], lon: c.coord[0], type: 'city', class: 'place' });
  });
  citiesEl.appendChild(b);
});

// Render the Layers section as grouped icon-buttons. Group title is
// click-to-toggle-all: if any item in the group is on, turn ALL off;
// if all are off, turn ALL on.
const togglesEl = document.getElementById('toggles');
LAYER_GROUPS.forEach(group => {
  const heading = document.createElement('div');
  heading.className = 'layer-group-title';
  heading.textContent = group.name;
  heading.title = 'Click to toggle all in this group';

  const grid = document.createElement('div');
  grid.className = 'layer-grid';

  heading.addEventListener('click', safe(() => {
    pushHistory();
    const allOn = group.items.every(i => state.layers[i.key]);
    const newVal = !allOn;
    group.items.forEach(i => {
      state.layers[i.key] = newVal;
      const btn = grid.querySelector(`button[data-layer="${i.key}"]`);
      if (btn) btn.classList.toggle('active', newVal);
    });
    restyle();
    persist();
  }, 'groupToggle'));

  togglesEl.appendChild(heading);

  group.items.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layer-btn' + (state.layers[item.key] ? ' active' : '');
    btn.dataset.layer = item.key;
    btn.innerHTML = `<span class="layer-icon">${item.icon}</span><span class="layer-label">${LAYER_LABELS[item.key]}</span>`;
    btn.addEventListener('click', safe(() => {
      pushHistory();
      state.layers[item.key] = !state.layers[item.key];
      btn.classList.toggle('active', !!state.layers[item.key]);
      restyle();
      persist();
    }, 'layerToggle'));
    grid.appendChild(btn);
  });
  togglesEl.appendChild(grid);
});

const bearingInput = document.getElementById('bearing');
const bearingVal = document.getElementById('bearingVal');
bearingInput.addEventListener('input', () => {
  state.bearing = parseFloat(bearingInput.value);
  map.setBearing(state.bearing);
  bearingVal.textContent = Math.round(state.bearing) + '°';
  persist();
});
const pitchInput = document.getElementById('pitch');
const pitchVal = document.getElementById('pitchVal');
pitchInput.addEventListener('input', () => {
  state.pitch = parseFloat(pitchInput.value);
  map.setPitch(state.pitch);
  pitchVal.textContent = Math.round(state.pitch) + '°';
  restyle(); // pitch toggles 3D extrusion
});

const buildingHeightEl = document.getElementById('buildingHeight');
const buildingHeightVal = document.getElementById('buildingHeightVal');
if (buildingHeightEl) buildingHeightEl.addEventListener('input', safe(() => {
  state.buildingHeight = parseFloat(buildingHeightEl.value);
  buildingHeightVal.textContent = state.buildingHeight.toFixed(1) + '×';
  restyle();
  persist();
}, 'buildingHeight'));

const rw = document.getElementById('roadWeight');
const rwVal = document.getElementById('roadWeightVal');
rw.addEventListener('input', () => {
  state.roadWeight = parseFloat(rw.value);
  rwVal.textContent = state.roadWeight.toFixed(1) + '×';
  restyle(); persist();
});

// ADR-061 — Distance-based framing dial. Converts a "show me N km
// wide" intent into a MapLibre zoom level using the standard tile
// math: zoom = log2(40075 * cos(lat) / distance_km) - 1 (the -1
// accounts for the map container being roughly 256-512px wide rather
// than a full tile). Re-derives on the fly from the current centre
// latitude so the slider stays accurate when panning across latitudes.
const frameDistanceEl = document.getElementById('frameDistance');
const frameDistanceVal = document.getElementById('frameDistanceVal');
function _zoomFromDistance(km) {
  const lat = (state.view && state.view.center && state.view.center[1]) || 0;
  // 40075 km is Earth circumference at equator; cos(lat) corrects for
  // the meridian convergence; -1 is an empirical adjustment so the slider
  // value matches the visible east-west extent in the typical poster
  // container size (~600 CSS px wide).
  const z = Math.log2((40075 * Math.cos(lat * Math.PI / 180)) / km) - 1;
  return Math.max(0.5, Math.min(20, z));
}
function _distanceFromZoom() {
  if (typeof map === 'undefined' || !map) return 6;
  try {
    const b = map.getBounds();
    const ne = b.getNorthEast(), sw = b.getSouthWest();
    const latMid = (ne.lat + sw.lat) / 2;
    return Math.abs((ne.lng - sw.lng) * 111.32 * Math.cos(latMid * Math.PI / 180));
  } catch (_) { return 6; }
}
if (frameDistanceEl && frameDistanceVal) {
  // Apply on commit (change), not while dragging — flying mid-drag is
  // jittery and burns tile fetches. Track value text live for feedback.
  frameDistanceEl.addEventListener('input', () => {
    frameDistanceVal.textContent = (+frameDistanceEl.value).toFixed(1) + ' km';
  });
  frameDistanceEl.addEventListener('change', safe(() => {
    pushHistory();
    const km = parseFloat(frameDistanceEl.value);
    const z = _zoomFromDistance(km);
    map.easeTo({ zoom: z, duration: 300 });
    persist();
  }, 'frameDistance'));
  // Keep the slider in sync as the user pans/zooms by other means.
  if (typeof map !== 'undefined' && map) {
    map.on('zoomend', () => {
      const km = _distanceFromZoom();
      frameDistanceEl.value = Math.max(1, Math.min(50, km));
      frameDistanceVal.textContent = km.toFixed(1) + ' km';
    });
  }
}

// roadStyle, border, texture, plus the new ADR-059 migrations
// (labelFont, titleWeight, titleSize, subtitleStyle, coordsStyle,
// compassStyle) all flow through the chip-group machinery in dials.js.
// Per-key post-apply hooks live in CHIP_AFTER there. No native <select>
// change listeners here anymore.

// Randomize style — picks a random value for every style dial.
const STYLE_OPTIONS = {
  roadStyle:     ['solid', 'dashed', 'dotted'],
  roadCaps:      ['round', 'butt', 'square'],
  labelFont:     ['Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic', 'Noto Sans Medium'],
  labelCase:     ['asis', 'uppercase', 'lowercase'],
  border:        ['none', 'thin', 'double', 'bold'],
  texture:       ['none', 'grain', 'halftone'],
  titleWeight:   ['regular', 'medium', 'bold', 'heavy'],
  titleSize:     ['small', 'medium', 'large', 'xl'],
  subtitleStyle: ['regular', 'italic'],
  coordsStyle:   ['decimal', 'dms'],
  roofTone:      ['match', 'lighter', 'darker', 'accent'],
  parkOpacity:   ['subtle', 'normal', 'bold'],
  cardShadow:    ['none', 'soft', 'hard', 'float'],
  buildingShape: ['filled', 'outlined', 'wireframe', 'ghost', 'bold', 'invert', 'halftone', 'accent', 'hairline'],
  // SVG-filter FX dial weighted toward 'none' so randomize doesn't always
  // produce a glitchy result — adding the bare value once gives 'none' a
  // 1/6 chance, the others 1/6 each. Bias toward 'none' so the
  // randomize button still produces tasteful posters most of the time.
  fxMode:        ['none', 'none', 'none', 'glitch', 'halftone', 'melt', 'bloom', 'posterize'],
};
document.getElementById('randomizeStyleBtn').addEventListener('click', safe(() => {
  pushHistory();
  Object.entries(STYLE_OPTIONS).forEach(([key, opts]) => {
    state[key] = opts[Math.floor(Math.random() * opts.length)];
  });
  applyState();
}, 'randomizeStyle'));

// Decoration toggles (compass / scale / date / grid / cityOutline / sun /
// sunArrow / zoomDisplay / frameOrnaments) are now driven by the icon-button
// grid via DECO_HANDLERS. The legacy checkbox handlers were removed — they
// referenced elements that no longer exist. bindEl (from LIB) makes any
// future "missing element" no-op silently instead of throwing.
// compassStyle is a chip-group now (ADR-059); see CHIP_AFTER in dials.js.

// Road-mode buttons in the Place panel — Off / Simple / Detailed
document.querySelectorAll('button[data-roads]').forEach(btn => {
  btn.addEventListener('click', safe(() => {
    pushHistory();
    applyRoadMode(btn.dataset.roads);
    syncControls();
    restyle();
    persist();
  }, 'roadMode'));
});

// Map icons section: category buttons + size + density sliders
(function wireMapIcons() {
  const grid    = document.getElementById('iconCategories');
  const sizeEl  = document.getElementById('iconSize');
  const sizeVal = document.getElementById('iconSizeVal');
  const dEl     = document.getElementById('iconDensity');
  const dVal    = document.getElementById('iconDensityVal');
  if (!grid || !sizeEl || !dEl) return;

  // Render one icon-button per category. Each button shows the actual
  // Pinhead pin that gets drawn on the map for this category, so the
  // picker visually matches the result. Loaded lazily via the same
  // cached fetcher used by the map markers.
  ICON_CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layer-btn' + (state.icons.categories[cat.key] ? ' active' : '');
    btn.dataset.iconcat = cat.key;
    btn.innerHTML = `<span class="layer-icon" data-pin="${cat.pin}">${cat.icon}</span><span class="layer-label">${cat.label}</span>`;
    btn.addEventListener('click', safe(() => {
      pushHistory();
      state.icons.categories[cat.key] = !state.icons.categories[cat.key];
      btn.classList.toggle('active', !!state.icons.categories[cat.key]);
      refreshPOIs();
      persist();
    }, 'iconCategory'));
    grid.appendChild(btn);
    // Async swap emoji for Pinhead SVG once it loads
    loadPinhead(cat.pin).then(svg => {
      if (!svg) return;
      const host = btn.querySelector('.layer-icon');
      host.innerHTML = svg;
      const sv = host.querySelector('svg');
      if (sv) {
        sv.setAttribute('width', '20');
        sv.setAttribute('height', '20');
        sv.style.fill = 'currentColor';
      }
    });
  });

  sizeEl.value = state.icons.size;
  sizeVal.textContent = state.icons.size + 'px';
  sizeEl.addEventListener('input', safe(() => {
    state.icons.size = parseInt(sizeEl.value, 10);
    sizeVal.textContent = state.icons.size + 'px';
    refreshPOIs();
    persist();
  }, 'iconSize'));

  dEl.value = state.icons.density;
  dVal.textContent = state.icons.density;
  dEl.addEventListener('input', safe(() => {
    state.icons.density = parseInt(dEl.value, 10);
    dVal.textContent = state.icons.density;
    refreshPOIs();
    persist();
  }, 'iconDensity'));

  // ADR-070 — per-category density panel. Renders one row per
  // ICON_CATEGORY with a 0..50 slider; -1 (the leftmost) means "use the
  // global Max". State at state.icons.densities[key] = number | undefined.
  const densHost = document.getElementById('iconCatDensities');
  if (densHost) {
    if (!state.icons.densities) state.icons.densities = {};
    densHost.innerHTML = ICON_CATEGORIES.map(cat => `
      <div class="row" style="margin-bottom: 4px;">
        <label style="font-size: 11.5px; min-width: 64px;">${cat.icon} ${cat.label}</label>
        <input type="range" data-poi-cat="${cat.key}" min="0" max="50" step="1" value="${state.icons.densities[cat.key] ?? 0}">
        <span class="val" data-poi-cat-val="${cat.key}">${state.icons.densities[cat.key] == null ? 'auto' : state.icons.densities[cat.key]}</span>
      </div>
    `).join('');
    densHost.addEventListener('input', safe(e => {
      const slider = e.target.closest('input[data-poi-cat]');
      if (!slider) return;
      const key = slider.dataset.poiCat;
      const v = parseInt(slider.value, 10);
      // 0 = "auto / fall back to global cap"; >0 = explicit per-cat cap.
      if (v === 0) delete state.icons.densities[key];
      else         state.icons.densities[key] = v;
      const valEl = densHost.querySelector(`span[data-poi-cat-val="${key}"]`);
      if (valEl) valEl.textContent = (v === 0) ? 'auto' : v;
      refreshPOIs();
      persist();
    }, 'iconCatDensity'));
  }

  // Master on/off — flip every category at once. Each click pushes a single
  // history entry, syncs every category button's .active class, then re-runs
  // the POI overlay once.
  function setAllCategories(on) {
    pushHistory();
    ICON_CATEGORIES.forEach(cat => { state.icons.categories[cat.key] = on; });
    grid.querySelectorAll('button[data-iconcat]').forEach(b => b.classList.toggle('active', on));
    refreshPOIs();
    persist();
  }
  const allOnBtn  = document.getElementById('iconAllOn');
  const allOffBtn = document.getElementById('iconAllOff');
  if (allOnBtn)  allOnBtn.addEventListener('click',  safe(() => setAllCategories(true),  'iconAllOn'));
  if (allOffBtn) allOffBtn.addEventListener('click', safe(() => setAllCategories(false), 'iconAllOff'));
})();

// Palette
const paletteEl = document.getElementById('palette');
let _lastEditedPaletteKey = null; // ADR-074 — for history replay-into-last
PALETTE_KEYS.forEach(k => {
  const lbl = document.createElement('label');
  lbl.innerHTML = `<div class="swatch-btn" data-key="${k}"><input type="color" data-key="${k}"></div><span>${PALETTE_LABELS[k]}</span>`;
  paletteEl.appendChild(lbl);
  const input = lbl.querySelector('input');
  input.addEventListener('input', safe(e => {
    state.palette[k] = e.target.value;
    _lastEditedPaletteKey = k;
    syncSwatches();
    restyle();
    // Marker chip background, ring and icon are all derived from the
    // palette — rebuild on any change so they keep matching the theme.
    if (['accent', 'bg', 'label'].includes(k)) refreshPOIs();
    persist();
  }, 'palettePicker'));
  input.addEventListener('change', e => {
    pushHistory();
    paletteHistoryAdd(e.target.value);
  });
});

// ADR-074 — Session palette history. The last 10 colours used (across
// any swatch) live in sessionStorage so the strip survives within a
// tab session but doesn't leak across tabs / browser restarts.
const PALETTE_HISTORY_KEY = 'osm-poster:palette-history';
const PALETTE_HISTORY_MAX = 10;
function paletteHistoryGet() {
  try { return JSON.parse(sessionStorage.getItem(PALETTE_HISTORY_KEY) || '[]'); }
  catch (_) { return []; }
}
function paletteHistoryAdd(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(hex)) return;
  let h = paletteHistoryGet();
  // Dedupe: move existing entry to the front rather than push duplicates.
  h = h.filter(x => x.toLowerCase() !== hex.toLowerCase());
  h.unshift(hex);
  if (h.length > PALETTE_HISTORY_MAX) h = h.slice(0, PALETTE_HISTORY_MAX);
  try { sessionStorage.setItem(PALETTE_HISTORY_KEY, JSON.stringify(h)); } catch (_) {}
  paletteHistoryRender();
}
function paletteHistoryRender() {
  let strip = document.getElementById('paletteHistory');
  if (!strip) {
    strip = document.createElement('div');
    strip.id = 'paletteHistory';
    strip.className = 'palette-history';
    paletteEl.parentNode.insertBefore(strip, paletteEl.nextSibling);
  }
  const history = paletteHistoryGet();
  strip.innerHTML = history.length
    ? history.map(c => `<button type="button" class="palette-history-chip" data-color="${c}" title="${c}" style="background:${c}"></button>`).join('')
    : '';
}
paletteEl.parentNode && paletteEl.parentNode.addEventListener('click', safe(e => {
  const chip = e.target.closest('.palette-history-chip');
  if (!chip) return;
  const color = chip.dataset.color;
  const targetKey = _lastEditedPaletteKey || PALETTE_KEYS[0];
  pushHistory();
  state.palette[targetKey] = color;
  syncSwatches();
  restyle();
  if (['accent', 'bg', 'label'].includes(targetKey)) refreshPOIs();
  persist();
}, 'paletteHistoryClick'));
paletteHistoryRender();

document.getElementById('seed').addEventListener('input', e => { state.seed = e.target.value; persist(); });

document.getElementById('reset').addEventListener('click', () => {
  pushHistory();
  Object.assign(state, clonePreset(state.preset));
  applyState();
});
document.getElementById('randomize').addEventListener('click', () => {
  pushHistory();
  randomizePalette();
  applyState();
});

// Frames (primary + More aspects)
document.querySelectorAll('button[data-frame]').forEach(btn => {
  btn.addEventListener('click', () => {
    pushHistory();
    state.frame = btn.dataset.frame;
    applyFrame();
    persist();
  });
});

// Disclosure toggling
document.querySelectorAll('.disclose-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.parentElement.classList.toggle('open');
  });
});

// Caption
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
titleInput.addEventListener('input', () => {
  state.caption.title = titleInput.value;
  if (typeof applyTitleOrnament === 'function') applyTitleOrnament();
  else document.getElementById('caption-title').textContent = titleInput.value || 'PARIS';
  persist();
});
subtitleInput.addEventListener('input', () => { state.caption.subtitle = subtitleInput.value; document.getElementById('caption-subtitle').textContent = subtitleInput.value || 'The City of Light'; persist(); });
// ADR-076 — Tagline (optional, italic small). Empty string -> empty
// element which CSS hides via :empty.
const taglineInput = document.getElementById('tagline');
if (taglineInput) {
  taglineInput.addEventListener('input', () => {
    state.caption.tagline = taglineInput.value;
    document.getElementById('caption-tagline').textContent = taglineInput.value || '';
    persist();
  });
}

const annivCheck = document.getElementById('anniversary');
const dateInput = document.getElementById('commemDate');
annivCheck.addEventListener('change', () => {
  state.caption.anniversary = annivCheck.checked;
  dateInput.style.display = state.caption.anniversary ? 'block' : 'none';
  applyCaption();
  persist();
});
dateInput.addEventListener('change', () => { state.caption.date = dateInput.value; applyCaption(); persist(); });

function applyCaption() {
  const cap = document.getElementById('caption');
  if (state.caption.anniversary) {
    cap.classList.add('anniversary');
    const t = state.caption.title || 'A & B';
    document.getElementById('caption-title').textContent = t.includes('&') ? t : `${t} & ___`;
    if (state.caption.date) {
      const d = new Date(state.caption.date + 'T00:00');
      const fmt = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      document.getElementById('caption-subtitle').textContent = fmt;
    }
  } else {
    cap.classList.remove('anniversary');
    document.getElementById('caption-title').textContent = state.caption.title || 'PARIS';
    document.getElementById('caption-subtitle').textContent = state.caption.subtitle || 'The City of Light';
  }
}

// GPX upload
document.getElementById('gpxFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const geo = parseGpx(text);
    if (!geo) { alert('Could not parse GPX (no track points found).'); return; }
    loadGpx(geo, true);
  } catch (err) { alert('Failed to read GPX: ' + err.message); }
  e.target.value = '';
});

// Drag-and-drop for GPX
const main = document.querySelector('main');
['dragenter','dragover','dragleave','drop'].forEach(ev =>
  main.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }));
main.addEventListener('drop', async e => {
  const file = e.dataTransfer.files[0];
  if (!file || !file.name.toLowerCase().endsWith('.gpx')) return;
  const text = await file.text();
  const geo = parseGpx(text);
  if (geo) loadGpx(geo, true);
});

// ADR-065 — Direct coordinate input. Detect "lat, lng" or DMS-style
// strings before falling through to Nominatim. Returns null when no
// valid pair is found so the caller knows to do a normal text search.
function parseCoordPair(s) {
  if (!s) return null;
  const trim = s.trim();
  // Decimal: "48.8566, 2.3522" or "48.8566 2.3522" with optional N/S/E/W.
  let m = trim.match(/^\s*(-?\d+(?:\.\d+)?)\s*([NSns])?\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*([EWew])?\s*$/);
  if (m) {
    let lat = parseFloat(m[1]);
    let lng = parseFloat(m[3]);
    if (m[2] && /[Ss]/.test(m[2])) lat = -Math.abs(lat);
    if (m[4] && /[Ww]/.test(m[4])) lng = -Math.abs(lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  // DMS: 48° 51' 24" N, 2° 21' 8" E (any combination of degree / minute /
  // second separators; unicode primes accepted).
  const dms = /(-?\d+)\s*[°dD\s]+\s*(\d+)?\s*['′mM\s]*\s*(\d+(?:\.\d+)?)?\s*["″sS]?\s*([NSEWnsew])?/g;
  const matches = [];
  let mm;
  while ((mm = dms.exec(trim)) && matches.length < 2) {
    let v = parseInt(mm[1], 10);
    const min = mm[2] ? parseInt(mm[2], 10) : 0;
    const sec = mm[3] ? parseFloat(mm[3]) : 0;
    let dec = Math.abs(v) + min / 60 + sec / 3600;
    if (v < 0) dec = -dec;
    if (mm[4] && /[Ss]/.test(mm[4])) dec = -Math.abs(dec);
    if (mm[4] && /[Ww]/.test(mm[4])) dec = -Math.abs(dec);
    matches.push({ value: dec, hint: mm[4] });
  }
  if (matches.length === 2) {
    // First with N/S hint or with abs <= 90 = lat. Second = lng.
    const [a, b] = matches;
    let lat, lng;
    if (a.hint && /[NSns]/.test(a.hint)) { lat = a.value; lng = b.value; }
    else if (b.hint && /[NSns]/.test(b.hint)) { lat = b.value; lng = a.value; }
    else { lat = a.value; lng = b.value; }
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

// Search
const searchEl = document.getElementById('search');
const resultsEl = document.getElementById('results');
let searchTimer;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchEl.value.trim();
  if (!q) { resultsEl.innerHTML = ''; return; }
  // ADR-065 — coord short-circuit: if the input parses as a lat/lng
  // pair, render a single "Go to (lat, lng)" result that flies the
  // map there directly without hitting Nominatim.
  const coord = parseCoordPair(q);
  if (coord) {
    resultsEl.innerHTML = `<div class="result" data-coord="1">📍 Go to ${coord.lat.toFixed(4)}°, ${coord.lng.toFixed(4)}°</div>`;
    resultsEl.querySelector('.result').addEventListener('click', () => {
      pushHistory();
      map.flyTo({ center: [coord.lng, coord.lat], zoom: Math.max(12, map.getZoom()) });
      resultsEl.innerHTML = ''; searchEl.value = '';
      persist();
    });
    return;
  }
  searchTimer = setTimeout(async () => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`, { headers: { 'Accept': 'application/json' } });
      const items = await r.json();
      resultsEl.innerHTML = items.map((it, i) => `<div class="result" data-i="${i}">${escapeHtml(it.display_name)}</div>`).join('');
      resultsEl.querySelectorAll('.result').forEach(el => {
        el.addEventListener('click', () => {
          const it = items[+el.dataset.i];
          pushHistory();
          if (it.boundingbox) {
            // ADR-078 — pick a sensible visible distance from the
            // bbox diagonal, clamped 2..20 km. Tokyo's bbox might be
            // 25 km across (too zoomed-out for a poster); a tiny
            // village's might be 0.4 km (too tight). The scaling
            // factor (0.6) leaves comfortable margins around the
            // place outline.
            const [s, n, w, e] = it.boundingbox.map(Number);
            const latMid = (s + n) / 2;
            const wKm = Math.abs((e - w) * 111.32 * Math.cos(latMid * Math.PI / 180));
            const hKm = Math.abs((n - s) * 110.574);
            const targetKm = Math.max(2, Math.min(20, Math.max(wKm, hKm) * 0.6));
            const z = _zoomFromDistance(targetKm);
            map.flyTo({ center: [+it.lon, +it.lat], zoom: z });
          } else {
            map.flyTo({ center: [+it.lon, +it.lat], zoom: 13 });
          }
          resultsEl.innerHTML = ''; searchEl.value = '';
          const name = it.display_name.split(',')[0].toUpperCase();
          state.caption.title = name;
          document.getElementById('title').value = name;
          document.getElementById('caption-title').textContent = name;
          persist();
          // ADR-025 / ADR-031: subtitle suggestions + city outline polygon
          onPlacePicked(it);
        });
      });
    } catch (e) { resultsEl.innerHTML = `<div class="result">Search failed.</div>`; }
  }, 400);
});
// escapeHtml lives in LIB.
