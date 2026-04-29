// =====================================================================
// OSM Poster — Photoshop-style filter stack
// Each filter is one full-bleed overlay (color / gradient / photo) that
// sits above the map but below decorative overlays. Composited via
// CSS mix-blend-mode so all the standard PS modes work: multiply,
// screen, overlay, color-burn, color-dodge, hard-light, soft-light,
// difference, exclusion, hue, saturation, color, luminosity.
//
// State shape (state.filters[]):
//   { id, enabled, type, blend, opacity, ...typeSpecific }
//   type   = 'color' | 'linear' | 'radial' | 'photo'
//   blend  = 'normal' | 'multiply' | ... | 'luminosity'
//   opacity = 0..100
// Per-type fields:
//   color  -> color
//   linear -> from, to, angle (deg)
//   radial -> inner, outer
//   photo  -> dataUrl (base64)
//
// Re-renders both the on-screen overlay (renderFilterStack) and the
// sidebar UI list (renderFilterList) on every mutation. applyState()
// in apply.js calls renderFilters() so undo/redo + URL hash loads
// pick the new state up automatically.
// =====================================================================

const FILTER_BLEND_MODES = [
  ['normal',      'Normal'],
  ['multiply',    'Multiply'],
  ['screen',      'Screen'],
  ['overlay',     'Overlay'],
  ['darken',      'Darken'],
  ['lighten',     'Lighten'],
  ['color-dodge', 'Dodge'],
  ['color-burn',  'Burn'],
  ['hard-light',  'Hard light'],
  ['soft-light',  'Soft light'],
  ['difference', 'Difference'],
  ['exclusion',   'Exclusion'],
  ['hue',         'Hue'],
  ['saturation',  'Saturation'],
  ['color',       'Color'],
  ['luminosity',  'Luminosity'],
];

const FILTER_TYPES = [
  ['color',  '🎨 Color'],
  ['linear', '⬢ Linear'],
  ['radial', '◉ Radial'],
  ['photo',  '📷 Photo'],
];

// Where in the 3-map z-stack the filter sits. Each target maps to a
// CSS slot div (or the full-bleed top slot for 'all'). A filter at
// target=buildings blends with the canvas BELOW it (bg + bg-targeted
// filters + buildings) and is overlaid by the fg map and any fg/all
// filters above it — i.e. real Photoshop-style per-layer compositing.
const FILTER_TARGETS = [
  ['all',       '🌐 All'],
  ['bg',        '💧 Background'],
  ['buildings', '🏢 Buildings'],
  ['fg',        '🛣 Foreground'],
];

// Valid target keys — used to assign the target-X class which carries
// the per-target z-index (set in css/poster.css). All filter divs live
// in the single #filterStack container; their z-index puts them at the
// right slot in #map-wrap's blending stack.
const _VALID_TARGETS = new Set(['all', 'bg', 'buildings', 'fg']);

let _filterIdCounter = 0;
function _newFilterId() {
  _filterIdCounter++;
  // Salt with the current timestamp's lower bits so reload-after-save
  // doesn't collide with freshly-restored ids.
  return 'fx' + Date.now().toString(36) + '_' + _filterIdCounter;
}

function _newFilter() {
  return {
    id: _newFilterId(),
    enabled: true,
    type: 'color',
    blend: 'multiply',
    opacity: 50,
    target: 'all',          // 'all' | 'bg' | 'buildings' | 'fg'
    color: '#ff8800',
    from: '#000000', to: '#ffffff', angle: 45,
    inner: '#ffffff', outer: '#000000',
    dataUrl: null,
  };
}

// CSS background string for a filter, used by the on-screen overlay.
function _filterBackgroundCSS(f) {
  if (f.type === 'color')  return f.color || '#ffffff';
  if (f.type === 'linear') {
    const a = (typeof f.angle === 'number') ? f.angle : 45;
    return `linear-gradient(${a}deg, ${f.from || '#000'}, ${f.to || '#fff'})`;
  }
  if (f.type === 'radial') {
    return `radial-gradient(circle at center, ${f.inner || '#fff'}, ${f.outer || '#000'})`;
  }
  if (f.type === 'photo' && f.dataUrl) return `url("${f.dataUrl}") center / cover`;
  return 'transparent';
}

// Cached masks: each overlay map's current canvas snapshot as a data
// URL, used to scope target=buildings / target=fg filters to the actual
// painted pixels of those layer groups. Refreshed on each map's idle so
// pan/zoom transitions don't pay the toDataURL cost.
const _maskUrls = { buildings: null, fg: null };

function _refreshMaskUrls() {
  // canvas.toDataURL() is synchronous and ~30-100ms for typical poster
  // sizes — bearable on idle, painful in a render loop. Wrapped in
  // try/catch in case the canvas is "tainted" (cross-origin tile data).
  try {
    if (typeof mapBuildings !== 'undefined' && mapBuildings) {
      _maskUrls.buildings = mapBuildings.getCanvas().toDataURL();
    }
  } catch (_) {}
  try {
    if (typeof mapFg !== 'undefined' && mapFg) {
      _maskUrls.fg = mapFg.getCanvas().toDataURL();
    }
  } catch (_) {}
  // Re-apply masks to existing layers without re-rendering the whole stack.
  document.querySelectorAll('.filter-layer.target-buildings').forEach(el => _applyMask(el, _maskUrls.buildings));
  document.querySelectorAll('.filter-layer.target-fg').forEach(el        => _applyMask(el, _maskUrls.fg));
}

function _applyMask(el, url) {
  if (!url) {
    el.style.maskImage = '';
    el.style.webkitMaskImage = '';
    return;
  }
  const v = `url("${url}")`;
  // alpha mode = use the alpha channel as the mask. Where the source
  // canvas pixel is transparent, the filter is invisible; where it's
  // opaque (a building / road / label rendered there), the filter
  // contributes its blend.
  el.style.maskImage = v;
  el.style.maskMode = 'alpha';
  el.style.maskSize = '100% 100%';
  el.style.webkitMaskImage = v;
  el.style.webkitMaskSize = '100% 100%';
}

function renderFilterStack() {
  const stack = document.getElementById('filterStack');
  if (!stack) return;
  stack.innerHTML = '';
  const list = state.filters || [];
  // List order: top entry should paint last (= on top). Walk in reverse.
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i];
    if (!f.enabled) continue;
    const target = _VALID_TARGETS.has(f.target) ? f.target : 'all';
    const div = document.createElement('div');
    div.className = 'filter-layer target-' + target;
    div.style.background = _filterBackgroundCSS(f);
    div.style.mixBlendMode = f.blend || 'normal';
    div.style.opacity = ((typeof f.opacity === 'number' ? f.opacity : 100) / 100).toFixed(2);
    if (target === 'buildings') _applyMask(div, _maskUrls.buildings);
    else if (target === 'fg')   _applyMask(div, _maskUrls.fg);
    // target=bg and target=all don't mask: bg map is fully opaque
    // (canvas background-color), and 'all' is meant to be full-bleed.
    stack.appendChild(div);
  }
}

// Build the body (type-specific inputs) for a single filter row.
function _buildFilterBody(f) {
  if (f.type === 'color') {
    return `
      <div class="filter-color-block">
        <label>Color
          <input type="color" data-id="${f.id}" data-field="color" value="${f.color || '#ffffff'}">
        </label>
      </div>
      <div class="row"><label>Opacity</label><input type="range" data-id="${f.id}" data-field="opacity" min="0" max="100" value="${f.opacity}"><span class="val">${f.opacity}%</span></div>
    `;
  }
  if (f.type === 'linear') {
    return `
      <div class="filter-color-grid">
        <label>From <input type="color" data-id="${f.id}" data-field="from" value="${f.from || '#000000'}"></label>
        <label>To <input type="color" data-id="${f.id}" data-field="to" value="${f.to || '#ffffff'}"></label>
      </div>
      <div class="row"><label>Angle</label><input type="range" data-id="${f.id}" data-field="angle" min="0" max="360" step="5" value="${f.angle}"><span class="val">${f.angle}&deg;</span></div>
      <div class="row"><label>Opacity</label><input type="range" data-id="${f.id}" data-field="opacity" min="0" max="100" value="${f.opacity}"><span class="val">${f.opacity}%</span></div>
    `;
  }
  if (f.type === 'radial') {
    return `
      <div class="filter-color-grid">
        <label>Inner <input type="color" data-id="${f.id}" data-field="inner" value="${f.inner || '#ffffff'}"></label>
        <label>Outer <input type="color" data-id="${f.id}" data-field="outer" value="${f.outer || '#000000'}"></label>
      </div>
      <div class="row"><label>Opacity</label><input type="range" data-id="${f.id}" data-field="opacity" min="0" max="100" value="${f.opacity}"><span class="val">${f.opacity}%</span></div>
    `;
  }
  if (f.type === 'photo') {
    const thumb = f.dataUrl ? `<img class="filter-photo-thumb" src="${f.dataUrl}" alt="">` : '';
    const action = f.dataUrl
      ? `<button class="filter-photo-clear" data-id="${f.id}" data-action="clearPhoto">Remove</button>`
      : '';
    return `
      ${thumb}
      <div class="filter-photo-row">
        <label class="filter-photo-pick">
          <input type="file" data-id="${f.id}" data-field="dataUrl" accept="image/*">
          <span>${f.dataUrl ? 'Replace photo' : 'Drop or pick a photo'}</span>
        </label>
        ${action}
      </div>
      <div class="row"><label>Opacity</label><input type="range" data-id="${f.id}" data-field="opacity" min="0" max="100" value="${f.opacity}"><span class="val">${f.opacity}%</span></div>
    `;
  }
  return '';
}

function _buildFilterRow(f) {
  const target = f.target || 'all';
  const typeOpts   = FILTER_TYPES.map(([v, lbl])  => `<option value="${v}"${v === f.type  ? ' selected' : ''}>${lbl}</option>`).join('');
  const blendOpts  = FILTER_BLEND_MODES.map(([v, lbl]) => `<option value="${v}"${v === f.blend ? ' selected' : ''}>${lbl}</option>`).join('');
  const targetOpts = FILTER_TARGETS.map(([v, lbl]) => `<option value="${v}"${v === target ? ' selected' : ''}>${lbl}</option>`).join('');
  const row = document.createElement('div');
  row.className = 'filter-row' + (f.enabled ? '' : ' disabled');
  row.dataset.id = f.id;
  row.innerHTML = `
    <div class="filter-row-head">
      <input type="checkbox" data-id="${f.id}" data-field="enabled"${f.enabled ? ' checked' : ''} title="Enable">
      <select data-id="${f.id}" data-field="type" title="Layer type">${typeOpts}</select>
      <select data-id="${f.id}" data-field="blend" title="Blend mode">${blendOpts}</select>
      <button data-id="${f.id}" data-action="up"   title="Move up">▲</button>
      <button data-id="${f.id}" data-action="down" title="Move down">▼</button>
      <button class="filter-del" data-id="${f.id}" data-action="del" title="Delete">×</button>
    </div>
    <div class="filter-row-target" style="margin-top: 6px;">
      <label style="font-size: 11px; color: var(--text-3); display: flex; align-items: center; gap: 6px;">
        Target
        <select data-id="${f.id}" data-field="target" title="Which map stratum this filter blends with">${targetOpts}</select>
      </label>
    </div>
    <div class="filter-row-body">${_buildFilterBody(f)}</div>
  `;
  return row;
}

function renderFilterList() {
  const list = document.getElementById('filterList');
  if (!list) return;
  list.innerHTML = '';
  (state.filters || []).forEach(f => list.appendChild(_buildFilterRow(f)));
}

// Single entry point used by applyState() and the in-module mutators.
function renderFilters() {
  renderFilterList();
  renderFilterStack();
}

function _findFilter(id) {
  return (state.filters || []).find(f => f.id === id);
}

function _patchFilter(id, patch) {
  const f = _findFilter(id);
  if (!f) return;
  Object.assign(f, patch);
}

// Wire up *delegated* event handlers — the row contents are rebuilt
// whenever the type changes, so attaching per-input listeners would
// leak. Delegating from #filterList lets us re-render freely.
(function wireFilterDelegation() {
  const list = document.getElementById('filterList');
  if (!list) return;

  list.addEventListener('click', safe(e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id     = btn.dataset.id;
    const action = btn.dataset.action;
    const f = _findFilter(id);
    if (!f) return;
    pushHistory();
    if (action === 'del') {
      state.filters = state.filters.filter(x => x.id !== id);
    } else if (action === 'up' || action === 'down') {
      const ix = state.filters.findIndex(x => x.id === id);
      const newIx = ix + (action === 'up' ? -1 : 1);
      if (newIx >= 0 && newIx < state.filters.length) {
        const tmp = state.filters[ix];
        state.filters[ix] = state.filters[newIx];
        state.filters[newIx] = tmp;
      }
    } else if (action === 'clearPhoto') {
      f.dataUrl = null;
    }
    renderFilters();
    persist();
  }, 'filterAction'));

  list.addEventListener('change', safe(e => {
    const el = e.target;
    if (!el.dataset || !el.dataset.id || !el.dataset.field) return;
    const id    = el.dataset.id;
    const field = el.dataset.field;
    const f = _findFilter(id);
    if (!f) return;
    if (field === 'dataUrl' && el.files && el.files[0]) {
      const file = el.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        pushHistory();
        f.dataUrl = reader.result;
        renderFilters();
        persist();
      };
      reader.readAsDataURL(file);
      return;
    }
    if (field === 'enabled') {
      pushHistory();
      f.enabled = el.checked;
    } else if (field === 'type' || field === 'blend' || field === 'target') {
      pushHistory();
      f[field] = el.value;
    }
    // Color-input change events fire on commit; range/value handled
    // in the input listener below for live updates.
    renderFilters();
    persist();
  }, 'filterChange'));

  // Live updates while dragging sliders / poking color pickers, without
  // a history entry per pixel.
  list.addEventListener('input', safe(e => {
    const el = e.target;
    if (!el.dataset || !el.dataset.id || !el.dataset.field) return;
    const id    = el.dataset.id;
    const field = el.dataset.field;
    const f = _findFilter(id);
    if (!f) return;
    if (el.type === 'range') {
      const v = parseInt(el.value, 10);
      f[field] = v;
      // Update the val pill next to the slider live
      const valEl = el.parentElement && el.parentElement.querySelector('.val');
      if (valEl) {
        const suffix = field === 'angle' ? '°' : (field === 'opacity' ? '%' : '');
        valEl.textContent = v + suffix;
      }
      renderFilterStack();
    } else if (el.type === 'color') {
      f[field] = el.value;
      renderFilterStack();
    }
  }, 'filterInput'));

  // Persist on slider/color release (one history entry per drag, not per
  // pixel). pushHistory was deferred — call it once on the final commit.
  let _pendingHistory = false;
  list.addEventListener('pointerdown', e => {
    if (e.target.matches('input[type="range"], input[type="color"]')) _pendingHistory = true;
  });
  list.addEventListener('change', e => {
    if (!_pendingHistory) return;
    if (!e.target.matches('input[type="range"], input[type="color"]')) return;
    _pendingHistory = false;
    pushHistory();
    persist();
  }, true);
})();

// Add / Clear all buttons — wired once at script load.
(function wireFilterToolbar() {
  const addBtn   = document.getElementById('addFilterBtn');
  const clearBtn = document.getElementById('clearFiltersBtn');
  if (addBtn) addBtn.addEventListener('click', safe(() => {
    pushHistory();
    if (!Array.isArray(state.filters)) state.filters = [];
    state.filters.unshift(_newFilter()); // newest at the top
    renderFilters();
    persist();
  }, 'filterAdd'));
  if (clearBtn) clearBtn.addEventListener('click', safe(() => {
    if (!state.filters || !state.filters.length) return;
    pushHistory();
    state.filters = [];
    renderFilters();
    persist();
  }, 'filterClear'));
})();

// Refresh the canvas masks every time the buildings/fg maps finish
// rendering. We listen on both maps so masks stay in sync after
// pan/zoom, layer toggles, or style changes. 'idle' fires once after
// each batch of tile loads + paint, so this doesn't run in a tight loop.
if (typeof mapBuildings !== 'undefined' && mapBuildings) {
  mapBuildings.on('idle', _refreshMaskUrls);
}
if (typeof mapFg !== 'undefined' && mapFg) {
  mapFg.on('idle', _refreshMaskUrls);
}

// Boot: backfill filters[] for legacy state and render.
if (!Array.isArray(state.filters)) state.filters = [];
renderFilters();
// First refresh — if the maps already idled before this script ran
// (unlikely but possible on cached-tile loads), pick up the masks now.
_refreshMaskUrls();
