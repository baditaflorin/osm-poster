// =====================================================================
// OSM Poster — state visibility & forgiveness pass
// ADR-109 active-dial badges, ADR-110 diff-from-template badge,
// ADR-113 per-panel reset, ADR-114 visible undo stack,
// ADR-118 recently-applied templates strip.
// =====================================================================

// ---------------------------------------------------------------------
// Panel-state-keys map: per-disclose-sub list of state keys controlled
// inside it. Computed from DOM (chip-groups / toggles / sliders),
// with a small manual override for cases the DOM-walk can't see (e.g.
// state.icons.density is owned by a slider with id 'iconDensity').
// ---------------------------------------------------------------------
function _panelKeys(panel) {
  const keys = new Set();
  // chip-groups → data-chip-key
  panel.querySelectorAll('.chip-group[data-chip-key]').forEach(g => keys.add(g.dataset.chipKey));
  // checkboxes → id maps to a state key (handled via STATE_KEY_BY_ID below)
  panel.querySelectorAll('input[type="checkbox"][id]').forEach(cb => {
    const k = STATE_KEY_BY_ID[cb.id];
    if (k) keys.add(k);
  });
  // sliders → id maps to state key
  panel.querySelectorAll('input[type="range"][id]').forEach(sl => {
    const k = STATE_KEY_BY_ID[sl.id];
    if (k) keys.add(k);
  });
  // text inputs (caption etc.)
  panel.querySelectorAll('input[type="text"][id]').forEach(inp => {
    const k = STATE_KEY_BY_ID[inp.id];
    if (k) keys.add(k);
  });
  return keys;
}

// id → state key. Centralises the messy mapping between DOM and state.
// Some keys are nested (caption.title, view.center, icons.density);
// for those the value is a dotted path that getStateValue / setStateValue
// resolve.
const STATE_KEY_BY_ID = {
  // sliders
  bearing: 'bearing', pitch: 'pitch', roadWeight: 'roadWeight',
  buildingHeight: 'buildingHeight', frameDistance: '_frameDistance',
  iconSize: 'icons.size', iconDensity: 'icons.density',
  mapSaturation: 'mapSaturation', mapContrast: 'mapContrast', mapHue: 'mapHue',
  titleSpacing: 'titleSpacingDelta', densitySlider: 'density',
  // toggles
  buildingShading: 'buildingShading', anniversary: 'caption.anniversary',
  trimGuidesToggle: 'showTrimGuides', scaleLockToggle: 'scaleLocked',
  bleedToggle: 'exportBleed',
  starsToggle: 'stars', sketchFrameToggle: 'sketchFrame',
  roadCasingToggle: 'roadCasing', roadGlowToggle: 'roadGlow',
  coastLineToggle: 'coastLine', parkSoftenToggle: 'parkSoften',
  centerRoundelToggle: 'centerRoundel', autoLegendToggle: 'autoLegend',
  edgeFadeToggle: 'edgeFade', captionCompactToggle: 'captionCompact',
  cmykPreviewToggle: 'cmykPreview', monotoneToggle: 'monotone',
  // text inputs
  title: 'caption.title', subtitle: 'caption.subtitle',
  tagline: 'caption.tagline', watermark: 'watermark', seed: 'seed',
};

function _getDotted(obj, path) {
  return path.split('.').reduce((o, k) => o == null ? undefined : o[k], obj);
}
function _setDotted(obj, path, val) {
  const parts = path.split('.');
  const last = parts.pop();
  const tgt = parts.reduce((o, k) => (o[k] = o[k] || {}), obj);
  tgt[last] = val;
}

// Returns the snapshot of "what the active template wants" for the
// currently selected preset. Falls back to defaultState for any field
// the template doesn't override.
function _templateSnapshot() {
  const def = (typeof defaultState === 'function') ? defaultState() : state;
  const tpl = (typeof clonePreset === 'function') ? clonePreset(state.preset) : {};
  return { ...def, ...tpl };
}

function _isEqualish(a, b) {
  // Numbers may differ by floating-point noise; round to 4 places.
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-4;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

// =====================================================================
// ADR-109 — Active-dial badges
// =====================================================================
function applyActiveBadges() {
  const tpl = _templateSnapshot();
  document.querySelectorAll('aside .disclose-sub').forEach(panel => {
    const keys = _panelKeys(panel);
    let changes = 0;
    keys.forEach(k => {
      // Skip pseudo-keys (those starting with _) — they're computed.
      if (k.startsWith('_')) return;
      const cur = _getDotted(state, k);
      const want = _getDotted(tpl, k);
      if (!_isEqualish(cur, want)) changes++;
    });
    // attr() can only read same-element attributes, so the count
    // sits on the .disclose-btn (which the ::after is attached to)
    // rather than on the .disclose-sub.
    const btn = panel.querySelector(':scope > .disclose-btn');
    if (changes > 0) {
      panel.classList.add('has-changes');
      if (btn) btn.dataset.changes = String(changes);
    } else {
      panel.classList.remove('has-changes');
      if (btn) delete btn.dataset.changes;
    }
  });
  // ADR-110 mirrors the total count into the top header badge.
  applyDiffBadge();
}

// =====================================================================
// ADR-110 — Diff-from-template top-level badge
// =====================================================================
function applyDiffBadge() {
  const badge = document.getElementById('diffBadge');
  if (!badge) return;
  let total = 0;
  document.querySelectorAll('aside .disclose-sub > .disclose-btn').forEach(btn => {
    const n = parseInt(btn.dataset.changes || '0', 10);
    if (n > 0) total += n;
  });
  if (total === 0) {
    badge.textContent = '';
    badge.style.display = 'none';
  } else {
    badge.textContent = total + ' change' + (total === 1 ? '' : 's');
    badge.style.display = '';
    badge.title = `${total} dial${total === 1 ? '' : 's'} differ from "${state.preset}". Click to see and revert individually.`;
  }
}

(function wireDiffBadgeClick() {
  // Click → modal listing each changed dial + per-dial revert button.
  document.addEventListener('click', e => {
    const badge = e.target.closest('#diffBadge');
    if (!badge) return;
    const tpl = _templateSnapshot();
    const rows = [];
    document.querySelectorAll('aside .disclose-sub').forEach(panel => {
      const keys = _panelKeys(panel);
      keys.forEach(k => {
        if (k.startsWith('_')) return;
        const cur = _getDotted(state, k);
        const want = _getDotted(tpl, k);
        if (!_isEqualish(cur, want)) {
          const subTitle = panel.querySelector('.disclose-title')?.textContent || '';
          rows.push({ panel: subTitle, key: k, cur, want });
        }
      });
    });
    if (!rows.length) return;
    // Build a tiny modal in-line. Re-uses the modal-overlay style.
    const html = `
      <div class="modal-overlay open" id="_diffModal">
        <div class="modal-wrap">
          <div class="modal" style="max-width: 480px;">
            <button class="close" id="_diffModalClose">&times;</button>
            <h2>Changes from "${escapeHtml(state.preset)}"</h2>
            <div class="modal-subtitle">${rows.length} dial${rows.length === 1 ? '' : 's'} differ from the template.</div>
            <div class="diff-list">
              ${rows.map(r => `
                <div class="diff-row">
                  <div class="diff-where">${escapeHtml(r.panel)} <span class="diff-key">${escapeHtml(r.key)}</span></div>
                  <div class="diff-vals">
                    <span class="diff-cur">${escapeHtml(JSON.stringify(r.cur))}</span>
                    →
                    <span class="diff-want">${escapeHtml(JSON.stringify(r.want))}</span>
                  </div>
                  <button class="diff-revert" data-key="${escapeHtml(r.key)}" title="Revert just this dial">↺ revert</button>
                </div>
              `).join('')}
            </div>
            <div class="actions" style="margin-top: 14px;">
              <button id="_diffRevertAll">↺ Revert all</button>
            </div>
          </div>
        </div>
      </div>`;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const modal = tmp.firstElementChild;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#_diffModalClose').addEventListener('click', close);
    modal.addEventListener('click', ev => { if (ev.target === modal) close(); });
    modal.querySelector('#_diffRevertAll').addEventListener('click', () => {
      pushHistory('revert all to ' + state.preset);
      Object.assign(state, clonePreset(state.preset));
      applyState(); persist(); close();
    });
    modal.querySelectorAll('.diff-revert').forEach(btn => btn.addEventListener('click', () => {
      pushHistory('revert ' + btn.dataset.key);
      _setDotted(state, btn.dataset.key, _getDotted(tpl, btn.dataset.key));
      applyState(); persist(); close();
    }));
  });
})();

// =====================================================================
// ADR-113 — Per-panel reset button
// =====================================================================
// Each .disclose-sub's body grows a small "↺ Reset section" link.
// Resets just the keys controlled by that panel to template defaults.
(function injectResetLinks() {
  document.querySelectorAll('aside .disclose-sub').forEach(panel => {
    const innerBody = panel.querySelector('.body > div');
    if (!innerBody) return;
    if (innerBody.querySelector('.reset-section-link')) return;  // idempotent
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'reset-section-link';
    link.textContent = '↺ Reset this section';
    link.title = 'Revert just this panel\'s dials to the active template defaults';
    innerBody.appendChild(link);
    link.addEventListener('click', safe(() => {
      const keys = _panelKeys(panel);
      const tpl = _templateSnapshot();
      pushHistory('reset section: ' + (panel.querySelector('.disclose-title')?.textContent || ''));
      keys.forEach(k => {
        if (k.startsWith('_')) return;
        _setDotted(state, k, _getDotted(tpl, k));
      });
      applyState();
      persist();
    }, 'panelReset'));
  });
})();

// =====================================================================
// ADR-114 — Visible undo stack in help modal
// =====================================================================
// Track action labels alongside the existing history snapshots so users
// can see what's on the undo stack. Wraps the existing pushHistory.
const _historyLabels = [];
const _origPushHistory = (typeof pushHistory === 'function') ? pushHistory : null;
if (_origPushHistory) {
  pushHistory = function(label) {
    _historyLabels.push({ label: label || 'change', ts: Date.now() });
    if (_historyLabels.length > 100) _historyLabels.shift();
    renderUndoStack();
    return _origPushHistory.apply(this, arguments);
  };
}
function renderUndoStack() {
  const host = document.getElementById('undoStack');
  if (!host) return;
  if (!_historyLabels.length) {
    host.innerHTML = '<div class="undo-empty">No actions yet.</div>';
    return;
  }
  // Render newest-first.
  host.innerHTML = _historyLabels.slice().reverse().slice(0, 30).map(h => {
    const t = new Date(h.ts);
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const ss = String(t.getSeconds()).padStart(2, '0');
    return `<div class="undo-row"><span class="undo-time">${hh}:${mm}:${ss}</span> ${escapeHtml(h.label)}</div>`;
  }).join('');
}

// =====================================================================
// ADR-118 — Recently-applied templates strip
// =====================================================================
// Top of the Templates panel shows up to 5 recently-clicked templates
// as horizontal chips. Stored in localStorage as a moving window.
const RECENT_KEY = 'osm-poster:recent-templates';
const RECENT_MAX = 5;
function _recentRead()  { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } }
function _recentWrite(a){ try { localStorage.setItem(RECENT_KEY, JSON.stringify(a)); } catch {} }
function recentTemplatesAdd(key) {
  if (!key) return;
  let list = _recentRead().filter(k => k !== key);
  list.unshift(key);
  if (list.length > RECENT_MAX) list = list.slice(0, RECENT_MAX);
  _recentWrite(list);
  renderRecentTemplates();
}
function renderRecentTemplates() {
  const host = document.getElementById('recentTemplates');
  if (!host) return;
  const list = _recentRead().filter(k => PRESETS[k] && PRESETS[k].isTemplate);
  if (!list.length) { host.style.display = 'none'; return; }
  host.style.display = '';
  host.innerHTML = list.map(k => `<button type="button" class="chip recent-tpl" data-key="${escapeHtml(k)}" title="Apply ${escapeHtml(PRESETS[k].name || k)}">${escapeHtml(PRESETS[k].name || k)}</button>`).join('');
}
(function wireRecentTemplates() {
  const host = document.getElementById('recentTemplates');
  if (!host) return;
  host.addEventListener('click', e => {
    const chip = e.target.closest('.recent-tpl');
    if (!chip) return;
    pushHistory('apply ' + chip.dataset.key);
    state.preset = chip.dataset.key;
    Object.assign(state, clonePreset(chip.dataset.key));
    applyState();
    persist();
  });
  // Also intercept template-card clicks so they push into the recent list.
  document.querySelectorAll('aside .templates .template').forEach(card => {
    card.addEventListener('click', () => {
      if (card.dataset.key) recentTemplatesAdd(card.dataset.key);
    }, true);
  });
  renderRecentTemplates();
})();

// =====================================================================
// ADR-115 — Real template thumbnails (on-demand cache)
// =====================================================================
// CSS-mocked template-card previews don't represent the actual
// rendered output. Replacing them with html-to-image renders is
// expensive (28 templates × ~1s each), so we do it on-demand and
// cache: the FIRST time a user clicks a template, we render the
// resulting poster as a tiny PNG and overlay it on the card. From
// then on the card shows the real preview.
//
// Cached in sessionStorage keyed by `${templateKey}|${centerHash}`
// so the cache invalidates when the user pans to a new place.
const TPL_CACHE_PREFIX = 'osm-poster:tpl-thumb:';
function _centerHash() {
  const c = (state.view && state.view.center) || [0, 0];
  return c.map(n => Math.round(n * 100) / 100).join(',');
}
function _tplCacheKey(key) {
  return TPL_CACHE_PREFIX + key + '|' + _centerHash();
}
async function captureTemplateThumb(templateKey) {
  const node = document.getElementById('poster');
  if (!node) return null;
  // Render at low DPI for speed. ~120×80 final size is plenty for a
  // sidebar card; pixelRatio 0.5 is fine.
  try {
    if (typeof htmlToImage === 'undefined') return null;
    const dataUrl = await htmlToImage.toPng(node, {
      pixelRatio: 0.5, cacheBust: false, skipFonts: true,
      backgroundColor: state.palette.bg,
    });
    try { sessionStorage.setItem(_tplCacheKey(templateKey), dataUrl); } catch {}
    return dataUrl;
  } catch (e) {
    console.warn('[tpl-thumb] failed', e);
    return null;
  }
}
function applyCachedThumb(card, templateKey) {
  const cached = sessionStorage.getItem(_tplCacheKey(templateKey));
  if (!cached) return;
  const preview = card.querySelector('.template-preview');
  if (!preview) return;
  preview.style.backgroundImage = `url("${cached}")`;
  preview.style.backgroundSize = 'cover';
  preview.style.backgroundPosition = 'center';
  preview.classList.add('has-real-thumb');
}
(function wireTemplateThumbs() {
  // On boot, paint any thumbnails that are already cached.
  document.querySelectorAll('aside .templates .template').forEach(card => {
    if (card.dataset.key) applyCachedThumb(card, card.dataset.key);
  });
  // After a click + applyState lands, capture and cache. The click
  // handler already changes state.preset and applies; we just hook
  // in after via a small delay so the render has stabilised.
  document.addEventListener('click', e => {
    const card = e.target.closest('aside .templates .template');
    if (!card || !card.dataset.key) return;
    setTimeout(async () => {
      const url = await captureTemplateThumb(card.dataset.key);
      if (url) applyCachedThumb(card, card.dataset.key);
    }, 1500); // wait for restyle + tile load
  });
})();

// Run badges + recent on first paint, then again any time applyState
// fires (hash load, undo/redo, etc). The applyState hook in apply.js
// already calls a typeof-guarded family — we rely on that.
applyActiveBadges();
