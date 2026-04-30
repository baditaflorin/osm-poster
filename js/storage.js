// =====================================================================
// OSM Poster — local-storage backed lists
// ADR-068 (favourite locations), ADR-062 (export profiles), and
// ADR-064 (JSON theme import/export). Each is a small CRUD over a
// localStorage key + a sidebar list. All three render lazily — if the
// container element doesn't exist yet (e.g. boot order), render() is
// a no-op and re-fires from applyState() on next state change.
// =====================================================================

// --- ADR-068 — Favourite locations ----------------------------------
const LS_FAVS = 'osm-poster:favs';
const LS_PROFILES = 'osm-poster:profiles';

function _favsRead()  { try { return JSON.parse(localStorage.getItem(LS_FAVS) || '[]'); } catch { return []; } }
function _favsWrite(a) { try { localStorage.setItem(LS_FAVS, JSON.stringify(a)); } catch {} }

function _favCurrent() {
  const c = map.getCenter();
  return {
    id:      'fav' + Date.now().toString(36),
    name:    state.caption.title || 'Untitled',
    center:  [c.lng, c.lat],
    zoom:    map.getZoom(),
    bearing: map.getBearing(),
    pitch:   map.getPitch(),
    ts:      Date.now(),
  };
}

function favsAddCurrent() {
  pushHistory();
  const list = _favsRead();
  list.unshift(_favCurrent());
  if (list.length > 24) list.length = 24;     // hard cap so localStorage doesn't bloat
  _favsWrite(list);
  renderFavourites();
}

function favsApply(id) {
  const f = _favsRead().find(x => x.id === id);
  if (!f) return;
  pushHistory();
  map.flyTo({ center: f.center, zoom: f.zoom, bearing: f.bearing || 0, pitch: f.pitch || 0, duration: 700 });
  state.caption.title = f.name;
  document.getElementById('title').value = f.name;
  document.getElementById('caption-title').textContent = f.name;
  persist();
}

function favsDelete(id) {
  const list = _favsRead().filter(x => x.id !== id);
  _favsWrite(list);
  renderFavourites();
}

function renderFavourites() {
  const host = document.getElementById('favouritesList');
  if (!host) return;
  const list = _favsRead();
  if (!list.length) {
    host.innerHTML = '<div style="font-size:11.5px; color:var(--text-3); padding: 6px 0;">No favourites yet — pin the current view with ⭐ to come back later.</div>';
    return;
  }
  host.innerHTML = list.map(f => `
    <div class="fav-row" data-id="${f.id}">
      <button type="button" class="fav-pick" data-id="${f.id}" title="Fly to this view">
        <span class="fav-name">${escapeHtml(f.name)}</span>
        <span class="fav-meta">${f.center[1].toFixed(2)}°, ${f.center[0].toFixed(2)}° · z ${(+f.zoom).toFixed(1)}</span>
      </button>
      <button type="button" class="fav-del" data-id="${f.id}" title="Delete favourite">×</button>
    </div>
  `).join('');
}

(function wireFavourites() {
  const host = document.getElementById('favouritesList');
  if (!host) return;
  host.addEventListener('click', safe(e => {
    const pick = e.target.closest('.fav-pick');
    const del  = e.target.closest('.fav-del');
    if (pick) favsApply(pick.dataset.id);
    else if (del) favsDelete(del.dataset.id);
  }, 'favClick'));
  bindEl('addFavBtn', 'click', safe(() => favsAddCurrent(), 'favAdd'));
  renderFavourites();
})();

// --- ADR-062 — Export profile bookmarks -----------------------------
// Each profile snapshots only the export-related state so loading one
// doesn't disturb your visual styling. The fields below are the union
// of "what affects the rendered file" without "what affects the look".
const _PROFILE_FIELDS = ['frame', 'exportBleed', 'exportDpi', 'mapMask', 'watermark', 'showTrimGuides'];
function _exportSizeAndFormat() {
  return {
    exportSize:   document.getElementById('exportSize')?.value   || 'a3',
    exportFormat: document.getElementById('exportFormat')?.value || 'png',
  };
}
function _profilesRead()  { try { return JSON.parse(localStorage.getItem(LS_PROFILES) || '[]'); } catch { return []; } }
function _profilesWrite(a) { try { localStorage.setItem(LS_PROFILES, JSON.stringify(a)); } catch {} }

function profileSave() {
  const name = (prompt('Name this export profile:', `${state.frame} ${(_exportSizeAndFormat().exportSize || '').toUpperCase()}`) || '').trim();
  if (!name) return;
  const list = _profilesRead();
  const snap = { id: 'p' + Date.now().toString(36), name, ts: Date.now(), ..._exportSizeAndFormat() };
  _PROFILE_FIELDS.forEach(k => { snap[k] = state[k]; });
  list.unshift(snap);
  if (list.length > 24) list.length = 24;
  _profilesWrite(list);
  renderProfiles();
}

function profileApply(id) {
  const p = _profilesRead().find(x => x.id === id);
  if (!p) return;
  pushHistory();
  _PROFILE_FIELDS.forEach(k => { if (k in p) state[k] = p[k]; });
  if (p.exportSize)   document.getElementById('exportSize').value   = p.exportSize;
  if (p.exportFormat) document.getElementById('exportFormat').value = p.exportFormat;
  applyState();
  persist();
}

function profileDelete(id) {
  _profilesWrite(_profilesRead().filter(x => x.id !== id));
  renderProfiles();
}

function renderProfiles() {
  const host = document.getElementById('profilesList');
  if (!host) return;
  const list = _profilesRead();
  if (!list.length) {
    host.innerHTML = '<div style="font-size:11.5px; color:var(--text-3); padding: 6px 0;">No saved profiles. Save the current export setup with the button above.</div>';
    return;
  }
  host.innerHTML = list.map(p => `
    <div class="fav-row" data-id="${p.id}">
      <button type="button" class="fav-pick" data-id="${p.id}" data-action="apply" title="Apply this profile">
        <span class="fav-name">${escapeHtml(p.name)}</span>
        <span class="fav-meta">${(p.exportSize || '').toUpperCase()} · ${(p.exportFormat || '').toUpperCase()} · ${(p.exportDpi === 'auto' || p.exportDpi == null) ? 'auto' : p.exportDpi + ' DPI'}${p.exportBleed ? ' · bleed' : ''}</span>
      </button>
      <button type="button" class="fav-del" data-id="${p.id}" title="Delete profile">×</button>
    </div>
  `).join('');
}

(function wireProfiles() {
  const host = document.getElementById('profilesList');
  if (!host) return;
  host.addEventListener('click', safe(e => {
    const pick = e.target.closest('.fav-pick');
    const del  = e.target.closest('.fav-del');
    if (pick) profileApply(pick.dataset.id);
    else if (del) profileDelete(del.dataset.id);
  }, 'profileClick'));
  bindEl('saveProfileBtn', 'click', safe(() => profileSave(), 'profileSave'));
  renderProfiles();
})();

// --- ADR-064 — JSON theme import / export ---------------------------
// One-shot serialization of the full state object as a downloadable
// `.osmposter.json` file, plus a paired upload that hydrates state.
// Version-stamped so future schema changes can migrate gracefully.
const THEME_SCHEMA_VERSION = 1;

function themeExport() {
  const blob = new Blob([JSON.stringify({
    schema:  THEME_SCHEMA_VERSION,
    name:    state.caption.title || 'Untitled',
    created: new Date().toISOString(),
    state:   state,
  }, null, 2)], { type: 'application/json' });
  const slug = (state.caption.title || 'theme').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'theme';
  const a = document.createElement('a');
  a.download = `${slug}.osmposter.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function themeImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = safe(() => {
    let parsed;
    try { parsed = JSON.parse(reader.result); }
    catch (e) { alert('Could not parse JSON: ' + e.message); return; }
    if (!parsed || typeof parsed.state !== 'object') {
      alert('That file is not an OSM Poster theme (no `state` object).');
      return;
    }
    if (parsed.schema && parsed.schema > THEME_SCHEMA_VERSION) {
      if (!confirm(`This theme was saved with a newer schema (v${parsed.schema}). Try to load anyway?`)) return;
    }
    pushHistory();
    state = mergeState(parsed.state);
    applyState();
    // Camera too — most themes care about this.
    if (state.view && state.view.center) {
      map.jumpTo({
        center: state.view.center,
        zoom:    state.view.zoom    || 12,
        bearing: state.bearing      || 0,
        pitch:   state.pitch        || 0,
      });
    }
    persist();
  }, 'themeImport');
  reader.readAsText(file);
}

bindEl('exportThemeBtn', 'click', safe(themeExport, 'themeExport'));
const themeImportInput = document.getElementById('themeImportInput');
if (themeImportInput) themeImportInput.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (f) themeImport(f);
  e.target.value = ''; // allow re-importing the same file
});
