// =====================================================================
// OSM Poster — newer dials (ADR-032..046, ADR-054..057)
// Big bag of toggles/sliders added in later iterations: vignette, stars,
// map saturation/contrast/hue, building height, road caps, sun lighting,
// sun arrow, zoom display, frame ornaments, sketch frame, etc.
// =====================================================================

// =====================================================================
// 10 NEW DIALS — ADR-032..041
// =====================================================================

// ADR-036 — vignette overlay (sync only; chip group handles input)
function applyVignette() {
  const v = document.getElementById('vignette');
  if (!v) return;
  ['soft','heavy','spotlight'].forEach(c => v.classList.remove('vignette-' + c));
  if (state.vignette && state.vignette !== 'none') v.classList.add('vignette-' + state.vignette);
}

// ADR-039 — sprinkle stars decorative overlay
function applyStars() {
  const s = document.getElementById('starsOverlay');
  if (!s) return;
  s.classList.toggle('on', !!state.stars);
  const cb = document.getElementById('starsToggle');
  if (cb) cb.checked = !!state.stars;
}
const starsCb = document.getElementById('starsToggle');
if (starsCb) starsCb.addEventListener('change', safe(e => {
  state.stars = e.target.checked; applyStars(); persist();
}, 'stars'));

// ADR-038 — caption divider style (sync only; chip group handles input)
function applyCaptionDivider() {
  const cap = document.getElementById('caption');
  if (!cap) return;
  ['none','line','dotted','double','wave'].forEach(c => cap.classList.remove('div-' + c));
  cap.classList.add('div-' + (state.captionDivider || 'line'));
}

// ADR-037 — title ornament wraps the title text. ORNAMENTS lives in DATA.
function decorateTitle(text) {
  return (ORNAMENTS[state.titleOrnament] || ORNAMENTS.none)(text || '');
}
function applyTitleOrnament() {
  const tEl = document.getElementById('caption-title');
  if (tEl) tEl.textContent = decorateTitle(state.caption.title || 'PARIS');
}

// ADR-034 / 035 — saturation + contrast (CSS filter compose w/ TOD)
function applyMapFilters() {
  const w = document.getElementById('map-wrap');
  if (!w) return;
  // Compute combined filter: TOD class still adds its filter via CSS;
  // we layer saturation/contrast as inline style.
  const s = (typeof state.mapSaturation === 'number') ? state.mapSaturation : 100;
  const c = (typeof state.mapContrast   === 'number') ? state.mapContrast   : 100;
  const parts = [];
  if (s !== 100) parts.push(`saturate(${s / 100})`);
  if (c !== 100) parts.push(`contrast(${c / 100})`);
  // The TOD class adds CSS-applied filter; inline filter replaces it.
  // To compose, we compute everything inline when either knob is active.
  if (parts.length || (state.tod && state.tod !== 'none' && state.tod !== 'day')) {
    let tod = state.tod;
    if (tod === 'auto') {
      const lng = (state.view && state.view.center && state.view.center[0]) || 0;
      const hour = ((new Date().getUTCHours() + (lng / 15)) % 24 + 24) % 24;
      tod = hour >= 5 && hour < 7 ? 'dawn' : hour < 17 ? 'day' : hour < 19 ? 'golden' : hour < 21 ? 'dusk' : 'night';
    }
    if (TOD_FILTERS[tod]) parts.unshift(TOD_FILTERS[tod]);
    w.style.filter = parts.join(' ');
  } else {
    w.style.filter = '';
  }
  const sa = document.getElementById('mapSaturation'),  saV = document.getElementById('mapSaturationVal');
  const co = document.getElementById('mapContrast'),    coV = document.getElementById('mapContrastVal');
  if (sa) sa.value = s; if (saV) saV.textContent = s + '%';
  if (co) co.value = c; if (coV) coV.textContent = c + '%';
}
['mapSaturation','mapContrast'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', safe(() => {
    state[id] = parseInt(el.value, 10);
    applyMapFilters(); persist();
  }, id));
});

// ADR-040 — title spacing fine adjustment
function applyTitleSpacing() {
  const t = document.getElementById('caption-title');
  if (!t) return;
  const delta = (typeof state.titleSpacingDelta === 'number') ? state.titleSpacingDelta : 0;
  t.style.letterSpacing = delta ? `calc(var(--ls, 6px) + ${delta}px)` : '';
  const el = document.getElementById('titleSpacing'), v = document.getElementById('titleSpacingVal');
  if (el) el.value = delta; if (v) v.textContent = (delta >= 0 ? '+' : '') + delta + 'px';
}
const spEl = document.getElementById('titleSpacing');
if (spEl) spEl.addEventListener('input', safe(() => {
  state.titleSpacingDelta = parseInt(spEl.value, 10);
  applyTitleSpacing(); persist();
}, 'titleSpacing'));

// ADR-032 / 033 — road casing & glow: these touch buildStyle. We toggle
// and call restyle(). buildingShape (ADR-041) is now a chip-group, wired
// via initChipGroups + the default CHIP_AFTER restyle, so it doesn't need
// a separate handler.
function syncEffectsToggles() {
  const a = document.getElementById('roadCasingToggle');  if (a) a.checked = !!state.roadCasing;
  const b = document.getElementById('roadGlowToggle');    if (b) b.checked = !!state.roadGlow;
}
const casingEl = document.getElementById('roadCasingToggle');
if (casingEl) casingEl.addEventListener('change', safe(e => {
  pushHistory(); state.roadCasing = e.target.checked; restyle(); persist();
}, 'roadCasing'));
const glowEl = document.getElementById('roadGlowToggle');
if (glowEl) glowEl.addEventListener('change', safe(e => {
  pushHistory(); state.roadGlow = e.target.checked; restyle(); persist();
}, 'roadGlow'));

// =====================================================================
// 5 MORE CREATIVE DIALS — ADR-042..046
// =====================================================================

// ADR-042 — Global hue rotation. Composes into the same filter chain
// as saturation/contrast/TOD by reusing applyMapFilters.
const _origApplyMapFilters = applyMapFilters;
applyMapFilters = function() {
  const w = document.getElementById('map-wrap');
  if (!w) return;
  const s = (typeof state.mapSaturation === 'number') ? state.mapSaturation : 100;
  const c = (typeof state.mapContrast   === 'number') ? state.mapContrast   : 100;
  const h = (typeof state.mapHue        === 'number') ? state.mapHue        : 0;
  const parts = [];
  if (s !== 100) parts.push(`saturate(${s / 100})`);
  if (c !== 100) parts.push(`contrast(${c / 100})`);
  if (h !== 0)   parts.push(`hue-rotate(${h}deg)`);
  let tod = state.tod;
  if (tod === 'auto') {
    // ADR-069 — pick the band from real solar altitude rather than
    // local-time hour brackets. SunCalc is already loaded for sun
    // lighting; reuse it for an astronomically-accurate auto TOD.
    // Falls back to hour-bracket math if SunCalc isn't available.
    const center = (state.view && state.view.center) || [0, 0];
    if (window.SunCalc) {
      try {
        const pos = SunCalc.getPosition(new Date(), center[1], center[0]);
        const alt = pos.altitude * 180 / Math.PI;
        if      (alt < -6)  tod = 'night';
        else if (alt < 0)   tod = 'dusk';   // also covers dawn — civil twilight is symmetric, palette differs by minimum minute-distance to dawn vs dusk
        else if (alt < 8)   tod = 'golden';
        else if (alt < 30)  tod = 'day';
        else                tod = 'day';
        // Disambiguate dusk vs dawn: dawn = altitude rising, dusk =
        // altitude falling. Sample +5 min ahead and compare.
        if (tod === 'dusk') {
          const future = SunCalc.getPosition(new Date(Date.now() + 5 * 60 * 1000), center[1], center[0]);
          if (future.altitude > pos.altitude) tod = 'dawn';
        }
      } catch (_) {
        const hour = ((new Date().getUTCHours() + (center[0] / 15)) % 24 + 24) % 24;
        tod = hour >= 5 && hour < 7 ? 'dawn' : hour < 17 ? 'day' : hour < 19 ? 'golden' : hour < 21 ? 'dusk' : 'night';
      }
    } else {
      const hour = ((new Date().getUTCHours() + (center[0] / 15)) % 24 + 24) % 24;
      tod = hour >= 5 && hour < 7 ? 'dawn' : hour < 17 ? 'day' : hour < 19 ? 'golden' : hour < 21 ? 'dusk' : 'night';
    }
  }
  if (TOD_FILTERS[tod]) parts.unshift(TOD_FILTERS[tod]);
  // SVG filter chain — applied LAST so the saturation/contrast/hue
  // adjustments above are part of the input to the FX pipeline.
  // 'none' is intentionally absent from FX_URLS so it just contributes
  // nothing to the chain.
  const FX_URLS = {
    glitch:    'url(#fx-glitch)',
    halftone:  'url(#fx-halftone)',
    melt:      'url(#fx-melt)',
    bloom:     'url(#fx-bloom)',
    posterize: 'url(#fx-posterize)',
  };
  if (FX_URLS[state.fxMode]) parts.push(FX_URLS[state.fxMode]);
  w.style.filter = parts.length ? parts.join(' ') : '';
  const sa = document.getElementById('mapSaturation'),  saV = document.getElementById('mapSaturationVal');
  const co = document.getElementById('mapContrast'),    coV = document.getElementById('mapContrastVal');
  const hu = document.getElementById('mapHue'),         huV = document.getElementById('mapHueVal');
  if (sa) sa.value = s; if (saV) saV.textContent = s + '%';
  if (co) co.value = c; if (coV) coV.textContent = c + '%';
  if (hu) hu.value = h; if (huV) huV.textContent = h + '°';
};
const hueEl = document.getElementById('mapHue');
if (hueEl) hueEl.addEventListener('input', safe(() => {
  state.mapHue = parseInt(hueEl.value, 10);
  applyMapFilters(); persist();
}, 'mapHue'));

// ADR-043 + ADR-047 — Map mask shapes & custom PNG/SVG mask.
// SAMPLE_MASK_DATAURL lives in DATA.
function readMaskCache() {
  try { return localStorage.getItem('osm-poster:mask') || null; } catch (_) { return null; }
}
function writeMaskCache(d) {
  try { d ? localStorage.setItem('osm-poster:mask', d) : localStorage.removeItem('osm-poster:mask'); } catch (_) {}
}
function applyMapMask() {
  const w = document.getElementById('map-wrap');
  if (!w) return;
  ['circle','rounded','hexagon','star','heart','custom'].forEach(n => w.classList.remove('mask-' + n));
  w.style.removeProperty('--mask-img');
  const m = state.mapMask || 'none';
  if (m === 'custom') {
    const data = readMaskCache();
    if (data) {
      w.classList.add('mask-custom');
      w.style.setProperty('--mask-img', `url("${data}")`);
    }
  } else if (m && m !== 'none') {
    w.classList.add('mask-' + m);
  }
  const sel = document.getElementById('mapMask');
  if (sel) sel.value = m;
  const status = document.getElementById('maskStatus');
  if (status) {
    const has = !!readMaskCache();
    status.textContent = m === 'custom'
      ? (has ? 'Using saved mask image' : 'Drop a PNG/SVG above or click Use sample')
      : (has ? 'Mask saved (select Custom to use it)' : '');
  }
}
const maskEl = document.getElementById('mapMask');
if (maskEl) maskEl.addEventListener('change', safe(e => {
  pushHistory(); state.mapMask = e.target.value; applyMapMask(); persist();
}, 'mapMask'));

// File upload — read image file as data URL, cache, switch select to Custom
const maskFileEl = document.getElementById('maskFile');
if (maskFileEl) maskFileEl.addEventListener('change', safe(e => {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    writeMaskCache(reader.result);
    pushHistory();
    state.mapMask = 'custom';
    applyMapMask();
    persist();
  };
  reader.readAsDataURL(f);
  e.target.value = '';
}, 'maskUpload'));

// Use built-in sample
const maskSampleBtn = document.getElementById('maskSampleBtn');
if (maskSampleBtn) maskSampleBtn.addEventListener('click', safe(() => {
  writeMaskCache(SAMPLE_MASK_DATAURL);
  pushHistory();
  state.mapMask = 'custom';
  applyMapMask();
  persist();
}, 'maskSample'));

// Clear cached mask + revert select to none
const maskClearBtn = document.getElementById('maskClearBtn');
if (maskClearBtn) maskClearBtn.addEventListener('click', safe(() => {
  writeMaskCache(null);
  pushHistory();
  state.mapMask = 'none';
  applyMapMask();
  persist();
}, 'maskClear'));

// ADR-044 — Sketch frame overlay. The SVG paths use stroke="currentColor"
// inline so html-to-image picks the color up reliably during export
// (CSS variables don't always survive the serialization).
function applySketchFrame() {
  const f = document.getElementById('sketchFrame');
  if (!f) return;
  f.classList.toggle('on', !!state.sketchFrame);
  f.style.color = (state.palette && state.palette.label) || '#111';
  const cb = document.getElementById('sketchFrameToggle');
  if (cb) cb.checked = !!state.sketchFrame;
}
const sketchCb = document.getElementById('sketchFrameToggle');
if (sketchCb) sketchCb.addEventListener('change', safe(e => {
  state.sketchFrame = e.target.checked; applySketchFrame(); persist();
}, 'sketchFrame'));

// ADR-045 — Custom watermark text replaces the default URL
function applyWatermark() {
  const el = document.querySelector('.caption-mark');
  if (!el) return;
  const w = (state.watermark || '').trim();
  el.textContent = w || 'baditaflorin.github.io/osm-poster';
  const inp = document.getElementById('watermark');
  if (inp && inp.value !== (state.watermark || '')) inp.value = state.watermark || '';
}
const wmEl = document.getElementById('watermark');
if (wmEl) wmEl.addEventListener('input', safe(() => {
  state.watermark = wmEl.value; applyWatermark(); persist();
}, 'watermark'));

// ADR-048..053 + ADR-058 — Style option dials
// Chip-group machinery: any element with [data-chip-key] becomes a
// touch-friendly pill row whose buttons set state[key] and run the
// right apply function. ONE handler covers every dial (DRY).
function applyCardShadow() {
  const w = document.getElementById('poster-wrap');
  if (!w) return;
  ['none','soft','hard','float'].forEach(c => w.classList.remove('shadow-' + c));
  w.classList.add('shadow-' + (state.cardShadow || 'soft'));
}

// Per-key effect after a chip is clicked. Default = restyle the map.
// Keys with CSS-only effects skip the map restyle entirely.
//
// ADR-059 — Caption typography (titleWeight/titleSize/subtitle/coords),
// label font, and compass style migrated from <select> to chip-group;
// each routes through here to its existing apply* function so the
// downstream code paths are unchanged.
const CHIP_AFTER = {
  border:         () => applyBorder(),
  texture:        () => applyTexture(),
  cardShadow:     () => applyCardShadow(),
  vignette:       () => applyVignette(),
  titleOrnament:  () => applyTitleOrnament(),
  captionDivider: () => applyCaptionDivider(),
  fxMode:         () => applyMapFilters(),
  // ADR-079 — Background pattern is purely a CSS class on #poster.
  bgPattern:      () => applyBgPattern(),
  // ADR-082/086/093 — chip-group keys whose effect lives in CSS classes
  // on #poster (or in style.js for roadHierarchy). The default chip
  // hook calls restyle() which is correct for hierarchy; the others
  // need a CSS class swap, handled by applyClassyDials().
  roadHierarchy:  () => restyle(),
  mapPadding:     () => applyClassyDials(),
  buildingShadow: () => applyClassyDials(),
  // ADR-098 — typography preset is atomic: it sets weight/size/etc.
  // in one go via applyTypographyPreset(), then we re-sync the chip
  // groups so the per-field chips reflect the new values.
  typographyPreset: () => {
    if (typeof applyTypographyPreset === 'function') applyTypographyPreset();
    if (typeof syncChipGroups === 'function') syncChipGroups();
    if (typeof applyTypography === 'function') applyTypography();
    if (typeof applyTitleOrnament === 'function') applyTitleOrnament();
    if (typeof applyCaptionDivider === 'function') applyCaptionDivider();
  },
  titleWeight:    () => applyTypography(),
  titleSize:      () => applyTypography(),
  subtitleStyle:  () => applyTypography(),
  coordsStyle:    () => {
    applyTypography();
    // Coords text uses the new format immediately; recompute from the
    // map's current center.
    try {
      const c = map.getCenter();
      const el = document.getElementById('caption-coords');
      if (el) el.textContent = formatCoords(c.lat, c.lng);
    } catch (_) {}
  },
  compassStyle:   () => applyCompass(),
  // labelFont is rendered by MapLibre — needs a full restyle (default).
};

const _chipDefaults = {
  roadStyle: 'solid', roadCaps: 'round',
  roofTone: 'match', labelCase: 'asis', parkOpacity: 'normal',
  border: 'none', texture: 'none', cardShadow: 'soft',
  vignette: 'none', titleOrnament: 'none', captionDivider: 'line',
  buildingShape: 'filled',
  titleWeight: 'bold', titleSize: 'medium',
  subtitleStyle: 'regular', coordsStyle: 'decimal',
  labelFont: 'Noto Sans Regular',
  compassStyle: 'classic',
  fxMode: 'none',
  bgPattern: 'none',
  exportDpi: 'auto',
  // ADR-082/086/093/098 — chip defaults for the cleanliness pass.
  roadHierarchy: 'firm',
  mapPadding: 'none',
  buildingShadow: 'none',
  typographyPreset: 'default',
};

// ADR-086/087/093/094/100 — toggle a set of CSS classes on #poster
// that drive the cleanliness flags. One function so adding another
// CSS-flag toggle is a one-line addition.
function applyClassyDials() {
  const el = document.getElementById('poster');
  if (!el) return;
  // padding-X
  ['none', 'cozy', 'breathing', 'loose'].forEach(c => el.classList.remove('padding-' + c));
  if (state.mapPadding && state.mapPadding !== 'none') el.classList.add('padding-' + state.mapPadding);
  // bldg-shadow-X
  ['none', 'subtle', 'lifted'].forEach(c => el.classList.remove('bldg-shadow-' + c));
  if (state.buildingShadow && state.buildingShadow !== 'none') el.classList.add('bldg-shadow-' + state.buildingShadow);
  // boolean classes
  el.classList.toggle('caption-compact', !!state.captionCompact);
  el.classList.toggle('edge-fade',        !!state.edgeFade);
  el.classList.toggle('cmyk-preview',     !!state.cmykPreview);
  // After CSS-level resize, give MapLibre a chance to read its new
  // container size — otherwise the WebGL canvas keeps the old dimensions
  // until the next pan.
  if (typeof map !== 'undefined' && map && map.resize) setTimeout(() => map.resize(), 50);
  if (typeof mapBuildings !== 'undefined' && mapBuildings) setTimeout(() => mapBuildings.resize(), 50);
  if (typeof mapFg !== 'undefined' && mapFg) setTimeout(() => mapFg.resize(), 50);
}

// ADR-081 — Density slider. Single 0..100 dial that progressively
// strips detail by re-styling the map. The actual filtering happens
// inside style.js (densityAllows + the road-class subset filter); this
// just owns the input event and triggers restyle.
const densitySlider = document.getElementById('densitySlider');
const densityVal    = document.getElementById('densityVal');
if (densitySlider && densityVal) {
  densitySlider.addEventListener('input', safe(() => {
    state.density = parseInt(densitySlider.value, 10);
    densityVal.textContent = state.density + '%';
    restyle();
    persist();
  }, 'density'));
  densitySlider.addEventListener('change', () => pushHistory());
}

// ADR-089/092/094/095/096/100/087/090 — boolean toggles. Each writes
// a single state flag, then routes to the appropriate apply function.
function _bindCleanlinessToggle(id, key, applyFn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', safe(e => {
    pushHistory();
    state[key] = e.target.checked;
    if (applyFn) applyFn();
    persist();
  }, id));
}
_bindCleanlinessToggle('coastLineToggle',     'coastLine',     restyle);
_bindCleanlinessToggle('parkSoftenToggle',    'parkSoften',    restyle);
_bindCleanlinessToggle('centerRoundelToggle', 'centerRoundel', () => typeof applyCenterRoundel === 'function' && applyCenterRoundel());
_bindCleanlinessToggle('autoLegendToggle',    'autoLegend',    () => typeof applyLegend === 'function' && applyLegend());
_bindCleanlinessToggle('edgeFadeToggle',      'edgeFade',      applyClassyDials);
_bindCleanlinessToggle('captionCompactToggle','captionCompact',applyClassyDials);
_bindCleanlinessToggle('cmykPreviewToggle',   'cmykPreview',   applyClassyDials);
// ADR-090 — Monotone lock. Apply derives the rest of the palette from bg.
_bindCleanlinessToggle('monotoneToggle',      'monotone',      () => {
  if (typeof applyMonotone === 'function') applyMonotone();
  if (typeof syncSwatches === 'function') syncSwatches();
  restyle();
});

// ADR-079 — Background pattern under the poster. Toggled via .bg-X
// class on #poster; CSS handles the actual pattern. None = no class.
function applyBgPattern() {
  const el = document.getElementById('poster');
  if (!el) return;
  ['none', 'rings', 'stripes', 'dotgrid', 'isobars'].forEach(c => el.classList.remove('bg-' + c));
  if (state.bgPattern && state.bgPattern !== 'none') el.classList.add('bg-' + state.bgPattern);
}

// ADR-073 — Trim-guide overlay toggle (3 mm dashed inset on #poster).
function applyTrimGuides() {
  const el = document.getElementById('poster');
  if (!el) return;
  el.classList.toggle('trim-on', !!state.showTrimGuides);
}
const trimToggleEl = document.getElementById('trimGuidesToggle');
if (trimToggleEl) trimToggleEl.addEventListener('change', safe(e => {
  pushHistory(); state.showTrimGuides = e.target.checked; applyTrimGuides(); persist();
}, 'trimGuides'));

// ADR-066 — Scale lock: disable scroll-zoom so pan can be done without
// accidental zoom drift. Visual indicator handled by toggling the
// checkbox + a data attribute on #map-wrap for any future styling.
function applyScaleLock() {
  const wrap = document.getElementById('map-wrap');
  if (wrap) wrap.dataset.scaleLocked = state.scaleLocked ? '1' : '0';
  if (typeof map === 'undefined' || !map || !map.scrollZoom) return;
  if (state.scaleLocked) map.scrollZoom.disable();
  else map.scrollZoom.enable();
}
const scaleLockEl = document.getElementById('scaleLockToggle');
if (scaleLockEl) scaleLockEl.addEventListener('change', safe(e => {
  pushHistory(); state.scaleLocked = e.target.checked; applyScaleLock(); persist();
}, 'scaleLock'));

// ADR-077 — Visible distance readout. Updates on every map move with
// the current bounds in km (or mi if locale uses imperial). Pure
// derived data — no state key.
function _formatDistance(km) {
  // Browser locale heuristic: en-US, en-GB-SCT use mi, everything else km.
  const useMi = /^(en-US|en-GB|en-LR|en-MM|my-MM)/i.test(navigator.language || '');
  if (useMi) return (km * 0.621371).toFixed(1) + ' mi';
  return km.toFixed(1) + ' km';
}
function updateDistanceReadout() {
  const el = document.getElementById('distanceReadout');
  if (!el) return;
  if (typeof map === 'undefined' || !map) return;
  try {
    const b = map.getBounds();
    const ne = b.getNorthEast(), sw = b.getSouthWest();
    // Equirectangular distance approximation — good enough for posters.
    const latMid = (ne.lat + sw.lat) / 2;
    const wKm = (ne.lng - sw.lng) * 111.32 * Math.cos(latMid * Math.PI / 180);
    const hKm = (ne.lat - sw.lat) * 110.574;
    el.textContent = _formatDistance(Math.abs(wKm)) + ' × ' + _formatDistance(Math.abs(hKm));
  } catch (_) {}
}
if (typeof map !== 'undefined' && map) {
  map.on('move', updateDistanceReadout);
  map.on('load', updateDistanceReadout);
  updateDistanceReadout();
}

function initChipGroups() {
  document.querySelectorAll('.chip-group[data-chip-key]').forEach(group => {
    const key = group.dataset.chipKey;
    const opts = JSON.parse(group.dataset.options || '[]');
    const current = state[key] || _chipDefaults[key];
    group.innerHTML = opts.map(([val, label]) =>
      `<button type="button" class="chip${val === current ? ' active' : ''}" data-value="${val}">${label}</button>`
    ).join('');
    group.addEventListener('click', safe(e => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      const val = btn.dataset.value;
      pushHistory();
      state[key] = val;
      group.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b === btn));
      (CHIP_AFTER[key] || (() => restyle()))();
      persist();
    }, 'chip:' + key));
  });
}
function syncChipGroups() {
  document.querySelectorAll('.chip-group[data-chip-key]').forEach(group => {
    const key = group.dataset.chipKey;
    const cur = state[key] || _chipDefaults[key];
    group.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b.dataset.value === cur));
  });
}

const buildingShadingEl = document.getElementById('buildingShading');
if (buildingShadingEl) buildingShadingEl.addEventListener('change', safe(e => {
  pushHistory(); state.buildingShading = e.target.checked; restyle(); persist();
}, 'buildingShading'));

function syncStyleDials() {
  syncChipGroups();
  const bs = document.getElementById('buildingShading');
  if (bs) bs.checked = state.buildingShading !== false;
}

// =====================================================================
// ADR-054..057 — sun lighting, sun arrow, zoom display, ornaments
// =====================================================================

// ADR-054 — Realistic sun lighting via MapLibre setLight + SunCalc
function sunColorFromAlt(alt) {
  if (alt <= 0)        return '#3a4a6a';   // night
  if (alt < 8)         return '#ff7a4a';   // sunrise / sunset
  if (alt < 25)        return '#ffd9a3';   // golden
  if (alt < 50)        return '#fff4d8';   // warm morning
  return '#ffffff';                         // bright noon
}
function applySunLight() {
  // Sun light only matters for the 3D building extrusions, which now live
  // on the buildings overlay map — point setLight there. The primary
  // (bg) and fg maps don't have any extrusions so setLight on them
  // would be a no-op anyway.
  const target = (typeof mapBuildings !== 'undefined' && mapBuildings) ? mapBuildings : map;
  if (!target || !target.setLight) return;
  if (!state.realisticLight || !window.SunCalc) {
    // Reset to MapLibre default
    try {
      target.setLight({ anchor: 'viewport', position: [1.15, 210, 30], color: '#ffffff', intensity: 0.5 });
    } catch (_) {}
    return;
  }
  try {
    const c = state.view && state.view.center;
    if (!c) return;
    const date = new Date();
    const pos = SunCalc.getPosition(date, c[1], c[0]);
    const azimuthDeg = ((pos.azimuth * 180 / Math.PI) + 180 + 360) % 360;
    const altitudeDeg = pos.altitude * 180 / Math.PI;
    const polar = Math.max(0, Math.min(180, 90 - altitudeDeg));
    const intensity = altitudeDeg <= 0 ? 0.18 : Math.min(0.85, 0.25 + (altitudeDeg / 90) * 0.6);
    target.setLight({
      anchor: 'map',
      position: [1.5, azimuthDeg, polar],
      color: sunColorFromAlt(altitudeDeg),
      intensity,
    });
  } catch (e) { reportError(e, 'applySunLight'); }
}

// ADR-055 — Sun direction arrow overlay
function applySunArrow() {
  const el = document.getElementById('sunArrow');
  if (!el) return;
  el.classList.toggle('on', !!state.sunArrow);
  if (!state.sunArrow || !window.SunCalc) return;
  try {
    const c = state.view && state.view.center;
    if (!c) return;
    const date = new Date();
    const pos = SunCalc.getPosition(date, c[1], c[0]);
    const azimuthDeg = ((pos.azimuth * 180 / Math.PI) + 180 + 360) % 360;
    const grp = document.getElementById('sunArrowGroup');
    if (grp) grp.setAttribute('transform', `rotate(${azimuthDeg})`);
    const txt = document.getElementById('sunArrowLabel');
    if (txt) {
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      txt.textContent = `${hh}:${mm}`;
      // text rotates back so it stays upright
      txt.setAttribute('transform', `rotate(${-azimuthDeg})`);
    }
    el.style.color = state.palette.label || '#111';
  } catch (e) { reportError(e, 'applySunArrow'); }
}

// ADR-056 — Zoom level indicator
function applyZoomDisplay() {
  const el = document.getElementById('zoomDisplay');
  if (!el) return;
  el.classList.toggle('on', !!state.zoomDisplay);
  if (state.zoomDisplay && map) {
    try { el.textContent = 'z ' + map.getZoom().toFixed(1); } catch (_) {}
  }
}

// ADR-057 — Vintage corner ornaments
function applyFrameOrnaments() {
  const el = document.getElementById('frameOrnaments');
  if (!el) return;
  el.classList.toggle('on', !!state.frameOrnaments);
}

// Unified decoration-button dispatch — single source of truth for the
// 9 toggle buttons, mapped to existing apply* functions.
const DECO_HANDLERS = {
  compass:        () => applyCompass(),
  scale:          () => {
    if (state.scale) { try { map.removeControl(scaleControl); } catch (_) {} map.addControl(scaleControl, 'bottom-left'); }
    else { try { map.removeControl(scaleControl); } catch (_) {} }
  },
  dateStamp:      () => applyDateStamp(),
  grid:           () => applyGrid(),
  cityOutline:    () => ensureCityOutline(),
  realisticLight: () => applySunLight(),
  sunArrow:       () => applySunArrow(),
  zoomDisplay:    () => applyZoomDisplay(),
  frameOrnaments: () => applyFrameOrnaments(),
};
document.querySelectorAll('button[data-deco]').forEach(btn => {
  btn.addEventListener('click', safe(() => {
    const k = btn.dataset.deco;
    pushHistory();
    state[k] = !state[k];
    btn.classList.toggle('active', !!state[k]);
    if (DECO_HANDLERS[k]) DECO_HANDLERS[k]();
    persist();
  }, 'decoBtn:' + btn.dataset.deco));
});
function syncDecorationGrid() {
  document.querySelectorAll('button[data-deco]').forEach(btn => {
    btn.classList.toggle('active', !!state[btn.dataset.deco]);
  });
}

// Live-track sun light + sun arrow + zoom display on map move
let _sunMoveTimer;
map.on('move', () => {
  if (!state.realisticLight && !state.sunArrow && !state.zoomDisplay) return;
  clearTimeout(_sunMoveTimer);
  _sunMoveTimer = setTimeout(() => {
    if (state.realisticLight) applySunLight();
    if (state.sunArrow)       applySunArrow();
    if (state.zoomDisplay)    applyZoomDisplay();
  }, 80);
});

// ADR-046 — Confetti micro-celebration
function fireConfetti(origin) {
  const main = document.querySelector('main');
  if (!main) return;
  // Use absolute positioning so left/top % work; main has position:relative? Check
  const stage = document.createElement('div');
  stage.style.cssText = 'position:absolute; left:0; top:0; right:0; bottom:0; pointer-events:none; z-index:1000;';
  main.style.position = main.style.position || 'relative';
  main.appendChild(stage);
  const colors = ['#FF61D2','#FE9090','#FFD972','#90F1B5','#9D90FF','#7DD3FC','#F472B6'];
  const count = 36;
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-particle';
    c.style.background = colors[i % colors.length];
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 120 + Math.random() * 200;
    c.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    c.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    c.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
    stage.appendChild(c);
  }
  setTimeout(() => stage.remove(), 1700);
}

// Hook randomize buttons + export to fire confetti
const _randBtn = document.getElementById('randomize');
if (_randBtn) _randBtn.addEventListener('click', () => fireConfetti());
const _randStyleBtn = document.getElementById('randomizeStyleBtn');
if (_randStyleBtn) _randStyleBtn.addEventListener('click', () => fireConfetti());
const _exportBtnConfetti = document.getElementById('export');
if (_exportBtnConfetti) _exportBtnConfetti.addEventListener('click', () => setTimeout(fireConfetti, 50));

// One-time chip group rendering — populates every [data-chip-key] container
// with its pill buttons. Must run before applyState's syncChipGroups so
// the active states have buttons to mark.
initChipGroups();

map.on('load', () => {
  ensureGpx();
  updateGpxStatus();
  applyState({ silent: true });
  history.past = []; // clean undo history at boot
});
