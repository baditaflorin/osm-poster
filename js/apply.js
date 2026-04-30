// =====================================================================
// OSM Poster — apply* helpers
// applyFrame / applyBorder / applyTexture / applyCompass / applyScale /
// applyTitle / etc. Each reads a slice of state and toggles classes /
// content on the captured #poster subtree.
// =====================================================================

// =====================================================================
// APPLY HELPERS
// =====================================================================
function applyFrame() {
  const w = document.getElementById('poster-wrap');
  ['portrait','square','landscape','story','a4','banner'].forEach(f => w.classList.remove('frame-' + f));
  w.classList.add('frame-' + state.frame);
  document.querySelectorAll('button[data-frame]').forEach(b => b.classList.toggle('active', b.dataset.frame === state.frame));
  setTimeout(() => map.resize(), 320);
}
function applyBorder() {
  const p = document.getElementById('poster');
  ['none','thin','double','bold'].forEach(b => p.classList.remove('border-' + b));
  if (state.border !== 'none') p.classList.add('border-' + state.border);
  p.style.setProperty('--border-color', state.palette.label);
  // The chip group syncs via syncChipGroups() — no select to update.
}
function applyTexture() {
  const g = document.getElementById('grain');
  g.classList.remove('grain-on', 'halftone-on');
  if (state.texture === 'grain') g.classList.add('grain-on');
  else if (state.texture === 'halftone') g.classList.add('halftone-on');
}
// COMPASS_VARIANTS lives in DATA — to add a new compass look, edit data.js.

function applyCompass() {
  const c = document.getElementById('compass');
  c.classList.toggle('hidden', !state.compass);
  c.style.color = state.palette.label;
  c.innerHTML = COMPASS_VARIANTS[state.compassStyle] || COMPASS_VARIANTS.classic;
  // Legacy compassToggle checkbox + compassStyle <select> no longer
  // exist — the Decoration grid button + chip-group are synced via
  // syncDecorationGrid() and syncChipGroups() respectively.
}

function applyDateStamp() {
  const el = document.getElementById('dateStamp');
  if (!el) return;
  el.classList.toggle('visible', !!state.dateStamp);
  el.style.color = state.palette.label;
  if (state.dateStamp) {
    const d = new Date();
    el.textContent = `${d.getFullYear()} · ${String(d.getMonth()+1).padStart(2,'0')} · ${String(d.getDate()).padStart(2,'0')}`;
  }
  const cb = document.getElementById('dateStampToggle');
  if (cb) cb.checked = !!state.dateStamp;
}

function applyGrid() {
  const el = document.getElementById('coordGrid');
  if (!el) return;
  el.classList.toggle('visible', !!state.grid);
  el.style.color = state.palette.label;
  const cb = document.getElementById('gridToggle');
  if (cb) cb.checked = !!state.grid;
}

// Road-mode preset (Off / Simple / Detailed) — batches multiple layer
// toggles in one click. ROAD_MODES lives in DATA.
function applyRoadMode(mode) {
  if (!ROAD_MODES[mode]) return;
  Object.assign(state.layers, ROAD_MODES[mode]);
  state.roadMode = mode;
  document.querySelectorAll('button[data-roads]').forEach(b => {
    b.classList.toggle('active', b.dataset.roads === mode);
  });
}
function syncSwatches() {
  PALETTE_KEYS.forEach(k => {
    const sw = paletteEl.querySelector(`.swatch-btn[data-key="${k}"]`);
    sw.style.background = state.palette[k];
    paletteEl.querySelector(`input[data-key="${k}"]`).value = state.palette[k];
  });
  applyBorder();
  applyCompass();
}
function syncControls() {
  togglesEl.querySelectorAll('.layer-btn').forEach(btn => {
    btn.classList.toggle('active', !!state.layers[btn.dataset.layer]);
  });
  rw.value = state.roadWeight; rwVal.textContent = state.roadWeight.toFixed(1) + '×';
  if (buildingHeightEl) {
    const bh = (typeof state.buildingHeight === 'number' && state.buildingHeight > 0) ? state.buildingHeight : 1;
    buildingHeightEl.value = bh;
    buildingHeightVal.textContent = bh.toFixed(1) + '×';
  }
  bearingInput.value = state.bearing; bearingVal.textContent = Math.round(state.bearing) + '°';
  pitchInput.value = state.pitch; pitchVal.textContent = Math.round(state.pitch) + '°';
  // Chip-grouped dials (roadStyle, roadCaps, labelCase, parkOpacity,
  // roofTone, border, texture, cardShadow, vignette, titleOrnament,
  // captionDivider) are synced by syncChipGroups() — see syncStyleDials.
  // ADR-059 — labelFont / titleWeight / titleSize / subtitleStyle /
  // coordsStyle / buildingShape are chip-groups now, synced by
  // syncChipGroups(). Only true-text inputs and the few remaining
  // selects (mapMask, todTint, exportFormat, exportSize) need setSelect.
  const setSelect = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setSelect('seed', state.seed || '');
  // Decoration toggles (compass / scale / cityOutline / sun light / etc.)
  // live in the icon-button grid now, synced via syncDecorationGrid().
  const bl = document.getElementById('bleedToggle');       if (bl) bl.checked = !!state.exportBleed;
  const td = document.getElementById('todTint');           if (td) td.value = state.tod || 'none';
  // ADR-073 / ADR-066 — toggle inputs need explicit sync since they
  // aren't chip-groups (only one boolean each, plain checkboxes).
  const tg = document.getElementById('trimGuidesToggle');  if (tg) tg.checked = !!state.showTrimGuides;
  const sl = document.getElementById('scaleLockToggle');   if (sl) sl.checked = !!state.scaleLocked;
  document.getElementById('title').value = state.caption.title || '';
  document.getElementById('subtitle').value = state.caption.subtitle || '';
  // ADR-076 — Tagline element + input. Empty string keeps the
  // element :empty so the CSS rule hides it.
  const taglineEl = document.getElementById('tagline');
  if (taglineEl) taglineEl.value = state.caption.tagline || '';
  const captionTaglineEl = document.getElementById('caption-tagline');
  if (captionTaglineEl) captionTaglineEl.textContent = state.caption.tagline || '';
  annivCheck.checked = state.caption.anniversary;
  dateInput.style.display = state.caption.anniversary ? 'block' : 'none';
  dateInput.value = state.caption.date || '';
  document.querySelectorAll('.preset').forEach(el => el.classList.toggle('active', el.dataset.key === state.preset));
  document.querySelectorAll('.template').forEach(el => el.classList.toggle('active', el.dataset.key === state.preset));
  syncSwatches();
  // Map icons category buttons + sliders
  document.querySelectorAll('button[data-iconcat]').forEach(btn => {
    btn.classList.toggle('active', !!state.icons.categories[btn.dataset.iconcat]);
  });
  const sizeEl  = document.getElementById('iconSize');
  const sizeVal = document.getElementById('iconSizeVal');
  if (sizeEl)  sizeEl.value = state.icons.size;
  if (sizeVal) sizeVal.textContent = state.icons.size + 'px';
  const dEl  = document.getElementById('iconDensity');
  const dVal = document.getElementById('iconDensityVal');
  if (dEl)  dEl.value = state.icons.density;
  if (dVal) dVal.textContent = state.icons.density;
}

function applyState({ silent } = {}) {
  syncControls();
  applyFrame();
  applyBorder();
  applyTexture();
  applyCompass();
  applyDateStamp();
  applyGrid();
  applyTypography();
  applyCaption();
  applyTOD();
  applyCustomFont();
  applyVignette();
  applyStars();
  applyCaptionDivider();
  applyTitleOrnament();
  applyMapFilters();
  applyTitleSpacing();
  syncEffectsToggles();
  applyMapMask();
  applySketchFrame();
  applyWatermark();
  applyCardShadow();
  syncStyleDials();
  applySunLight();
  applySunArrow();
  applyZoomDisplay();
  applyFrameOrnaments();
  syncDecorationGrid();
  // ADR-079 / ADR-073 / ADR-066 — pull the latest state into the new
  // CSS-driven dials. Wrapped in typeof guards so applyState() stays
  // callable during boot before dials.js evaluates these functions.
  if (typeof applyBgPattern    === 'function') applyBgPattern();
  if (typeof applyTrimGuides   === 'function') applyTrimGuides();
  if (typeof applyScaleLock    === 'function') applyScaleLock();
  // ADR-086/087/093/094/100 — CSS classes on #poster.
  if (typeof applyClassyDials  === 'function') applyClassyDials();
  // ADR-088 — title kerning curve.
  if (typeof applyTitleKerning === 'function') applyTitleKerning();
  // ADR-090 — monotone lock derives palette from bg if enabled.
  if (typeof applyMonotone     === 'function') applyMonotone();
  // ADR-095 — centre roundel marker on the named coordinate.
  if (typeof applyCenterRoundel === 'function') applyCenterRoundel();
  // ADR-096 — auto-legend in corner of the map.
  if (typeof applyLegend       === 'function') applyLegend();
  // ADR-077 — distance readout updates on map move; trigger one now
  // so a hash-load with a freshly-restored center shows the right value.
  if (typeof updateDistanceReadout === 'function') updateDistanceReadout();
  // Sync new boolean toggles (cleanliness pass).
  ['coastLineToggle:coastLine', 'parkSoftenToggle:parkSoften', 'centerRoundelToggle:centerRoundel',
   'autoLegendToggle:autoLegend', 'edgeFadeToggle:edgeFade', 'captionCompactToggle:captionCompact',
   'cmykPreviewToggle:cmykPreview', 'monotoneToggle:monotone'].forEach(pair => {
    const [id, key] = pair.split(':');
    const cb = document.getElementById(id);
    if (cb) cb.checked = !!state[key];
  });
  // Sync density slider value
  const ds = document.getElementById('densitySlider');
  const dv = document.getElementById('densityVal');
  if (ds && dv) {
    ds.value = (typeof state.density === 'number') ? state.density : 100;
    dv.textContent = ds.value + '%';
  }
  // The filter stack module loads after apply.js; the typeof guard keeps
  // applyState() callable during boot before filters.js evaluates, and
  // is a no-op once it's defined.
  if (typeof renderFilters === 'function') renderFilters();
  restyle();
  refreshPOIs();
  renderAnnotations();
  renderPolaroids();
  ensureCityOutline();
  // refresh coords text with current format
  try {
    const c = map.getCenter();
    document.getElementById('caption-coords').textContent = formatCoords(c.lat, c.lng);
  } catch (_) {}
  if (state.scale) {
    try { map.removeControl(scaleControl); } catch (e) {}
    map.addControl(scaleControl, 'bottom-left');
  }
  if (!silent) persist();
}
