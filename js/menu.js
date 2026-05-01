// =====================================================================
// OSM Poster — menu unification long-tail (ADR-123/125/126/133/134/136/139)
// Small features that share a theme: surface-level UX improvements to
// the sidebar that don't fit any other module.
// =====================================================================

// =====================================================================
// ADR-125 — Top action toolbar
// =====================================================================
// 3 most-frequent actions pinned just below the search box, visible at
// every scroll position. Re-uses the existing button handlers — these
// are aliases, not new behaviour.
(function wireTopToolbar() {
  const t = id => document.getElementById(id);
  bindEl('topRandomizeBtn', 'click', () => t('randomize') && t('randomize').click());
  bindEl('topCycleBtn',     'click', () => t('cycleTemplatesBtn') && t('cycleTemplatesBtn').click());
  bindEl('topExportBtn',    'click', () => t('export') && t('export').click());
  // The ⌘K shortcut is already wired in cohesion.js — clicking the
  // pinned button just simulates the keystroke effect.
  bindEl('topPaletteBtn',   'click', () => {
    const overlay = document.getElementById('cmdPalette');
    if (overlay) overlay.classList.add('open');
    const input = document.getElementById('cmdPaletteInput');
    if (input) setTimeout(() => input.focus(), 50);
  });
})();

// =====================================================================
// ADR-139 — Quiet mode
// =====================================================================
// Dims the sidebar to 40% opacity. Hover restores 100%. Pure CSS via
// body.quiet-mode + a small CSS rule (in poster.css). Toggle persists
// in localStorage so it survives reload.
const QUIET_KEY = 'osm-poster:quiet';
function applyQuietMode() {
  const on = localStorage.getItem(QUIET_KEY) === '1';
  document.body.classList.toggle('quiet-mode', on);
  const btn = document.getElementById('quietModeBtn');
  if (btn) btn.classList.toggle('active', on);
}
bindEl('quietModeBtn', 'click', () => {
  const cur = localStorage.getItem(QUIET_KEY) === '1';
  try { localStorage.setItem(QUIET_KEY, cur ? '0' : '1'); } catch {}
  applyQuietMode();
});
applyQuietMode();

// =====================================================================
// ADR-134 — Conditional dial visibility
// =====================================================================
// Some controls only have an effect when a precondition is met
// (e.g. sun light needs pitch > 0). Each entry is { selector, when,
// reason }. We poll on every applyState — cheap because the selectors
// are pre-cached and the predicate is a one-line check.
const CONDITIONAL_DIALS = [
  {
    selector: '#decorationGrid button[data-deco="realisticLight"], #decorationGrid button[data-deco="sunArrow"]',
    when: () => (typeof state !== 'undefined') && state.pitch > 0,
    reason: 'Needs Tilt > 0 to light 3D buildings',
  },
  {
    selector: '.chip-group[data-chip-key="buildingShape"] .chip, .chip-group[data-chip-key="roofTone"] .chip, #buildingShading',
    when: () => state.layers && state.layers.buildings,
    reason: 'Needs the Buildings layer enabled',
  },
  {
    selector: '#frameOrnaments, #sketchFrameToggle',
    when: () => true,
    reason: '',
  },
];
function applyConditionalDials() {
  CONDITIONAL_DIALS.forEach(rule => {
    const enabled = !!rule.when();
    document.querySelectorAll(rule.selector).forEach(el => {
      el.classList.toggle('dial-disabled', !enabled);
      if (!enabled && rule.reason) el.title = rule.reason;
    });
  });
}

// =====================================================================
// ADR-136 — Onboarding progress badges
// =====================================================================
// Each major tab gets a small "1/4..4/4" badge during the user's first
// 5 sessions. Click any tab to mark it as explored; once all 4 are
// explored, badges retire forever. Session counter in localStorage
// gates the visibility.
const ONBOARD_KEY = 'osm-poster:onboard';
function _onboardRead()  { try { return JSON.parse(localStorage.getItem(ONBOARD_KEY) || '{"sessions":0,"explored":[]}'); } catch { return { sessions: 0, explored: [] }; } }
function _onboardWrite(o){ try { localStorage.setItem(ONBOARD_KEY, JSON.stringify(o)); } catch {} }
function _onboardOnLoad() {
  const o = _onboardRead();
  o.sessions = (o.sessions || 0) + 1;
  _onboardWrite(o);
  return o;
}
function applyOnboardingBadges() {
  const o = _onboardRead();
  // Hide badges after 5 sessions OR when all 4 majors explored.
  const tabs = ['Place', 'Style', 'Effects', 'Compose'];
  if (o.sessions > 5 || tabs.every(t => (o.explored || []).includes(t))) {
    document.querySelectorAll('.major-tab .onboard-badge').forEach(b => b.remove());
    return;
  }
  tabs.forEach((tabName, i) => {
    const tab = document.querySelector(`.major-tab[data-tab="${tabName}"]`);
    if (!tab) return;
    let badge = tab.querySelector('.onboard-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'onboard-badge';
      tab.appendChild(badge);
    }
    const explored = (o.explored || []).includes(tabName);
    badge.textContent = explored ? '✓' : `${i + 1}/4`;
    badge.classList.toggle('explored', explored);
  });
}
function markTabExplored(tabName) {
  const o = _onboardRead();
  if (!o.explored) o.explored = [];
  if (!o.explored.includes(tabName)) {
    o.explored.push(tabName);
    _onboardWrite(o);
    applyOnboardingBadges();
  }
}
// Hook tab clicks to mark explored.
document.querySelectorAll('.major-tab').forEach(tab => {
  tab.addEventListener('click', () => markTabExplored(tab.dataset.tab));
});
_onboardOnLoad();
applyOnboardingBadges();

// =====================================================================
// ADR-133 — Help drawer per major panel
// =====================================================================
// Each major tab grows a small "?" mini-button. Click → side drawer
// shows all per-section help text for that major collected in one
// place. Reuses HELP_TEXT from cohesion.js.
const MAJOR_HELP = {
  Place: [
    ['Search',   'Type a city, address, or coordinates ("48.85, 2.34"). Star a result to save it as a favourite. Coords short-circuit Nominatim — pasting "lat, lng" flies the map there directly.'],
    ['View',     'The Frame km slider picks zoom from a "show me X km wide" intent. Lock zoom (🔒) lets you fine-tune pan without zoom drift. Heights multiplies 3D buildings (only visible when Tilt > 0).'],
    ['GPX route','Drag a .gpx file onto the drop zone to overlay your run/ride/hike on the map in the accent colour.'],
  ],
  Style: [
    ['Templates','28 hand-tuned full looks — palette + frame + texture + caption + dials all set together. Click Cycle to flip through them. Recently-used ones auto-pin to a strip at the top.'],
    ['Palette',  '11 themed palettes + 9 custom-color pickers. Monotone lock derives every swatch from the bg colour for one-color posters. Drop a photo onto the harvest zone to extract a palette automatically.'],
    ['Layers',   'Click any layer button to toggle it. Click a category title (WATER, NATURE, BUILT…) to toggle every layer in that group at once.'],
    ['Map style','Density slider strips detail progressively — a one-handle "MapToPoster look" dial. Road hierarchy ramps how loud motorways are vs minor lanes (Flat to Extreme 8:1). Roads, buildings, parks, labels each get their own chip rows.'],
  ],
  Effects: [
    ['Filter stack','Photoshop-style blend layers stacked over the map. Each filter targets a stratum (All / Background / Buildings / Foreground) and blends with everything beneath it. Top-of-list paints on top.'],
    ['Map filters','Saturation/contrast/hue chain together; FX mode drops a transformative SVG filter on top (Glitch / Halftone / Melt / Bloom / Posterize). Vignette and TOD tint compose with the rest.'],
    ['Decorations','Compass / scale / sun light / sun arrow / zoom display / ornaments — one click each. Mask cuts the map into circle / hexagon / heart / star / custom shapes. Sketch frame overlays a hand-drawn double border.'],
    ['Map icons','POI markers from real OSM data. Pick categories, set size + density, or use per-category density caps for fine control.'],
  ],
  Compose: [
    ['Caption',     'Title (uppercase by default), subtitle, optional small italic tagline, optional custom watermark. The 6 typography presets (Default / Editorial / Modern / Vintage / Brutalist / Quiet) snap weight + size + style atomically.'],
    ['Frame',       'Aspect ratio · border · texture · card shadow · background pattern. Trim guides shows where the 3 mm bleed line will land. CMYK preview approximates how the colours will shift in print.'],
    ['Pins',        'Click on the map to drop a text annotation; drop a photo into the polaroid zone and click on the map to pin it.'],
    ['Library',     'Save the current camera as a favourite, save the current export setup as a profile, or download the whole state as a portable JSON theme.'],
    ['Batch render','Paste share-URLs (one per line) and render every one to a ZIP. Useful for series — a city\'s neighbourhoods, a trip\'s stops.'],
  ],
};
function openMajorHelp(major) {
  const entries = MAJOR_HELP[major] || [];
  if (!entries.length) return;
  // Build modal in-line (re-uses .modal-overlay styling).
  const html = `
    <div class="modal-overlay open" id="_majorHelp">
      <div class="modal-wrap">
        <div class="modal" style="max-width: 540px;">
          <button class="close" id="_majorHelpClose">&times;</button>
          <h2>${escapeHtml(major)} — guide</h2>
          <div class="modal-subtitle">All sub-panel explainers in one place.</div>
          ${entries.map(([title, body]) => `
            <h4>${escapeHtml(title)}</h4>
            <p style="font-size:13px; line-height:1.55; color:#444;">${escapeHtml(body)}</p>
          `).join('')}
        </div>
      </div>
    </div>`;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const m = tmp.firstElementChild;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.querySelector('#_majorHelpClose').addEventListener('click', close);
  m.addEventListener('click', e => { if (e.target === m) close(); });
}
// Inject a (?) button into each tab.
document.querySelectorAll('.major-tab').forEach(tab => {
  if (tab.querySelector('.tab-help')) return;
  const help = document.createElement('button');
  help.type = 'button';
  help.className = 'tab-help';
  help.textContent = '?';
  help.title = 'Open the guide for this category';
  help.addEventListener('click', e => {
    e.stopPropagation();
    openMajorHelp(tab.dataset.tab);
  });
  tab.appendChild(help);
});

// Hook conditional dials into applyState by replacing applyState with
// a wrapper. The wrapper preserves return value semantics and any
// future apply-time work inside applyState.
const _origApplyState_menu = (typeof applyState === 'function') ? applyState : null;
if (_origApplyState_menu) {
  applyState = function() {
    const r = _origApplyState_menu.apply(this, arguments);
    try { applyConditionalDials(); } catch (_) {}
    return r;
  };
}
applyConditionalDials();
