// =====================================================================
// OSM Poster — output-cleanliness pass (ADR-081..100)
// State-driven visual refinements that aren't worth a full module each:
//   ADR-088 title kerning by length
//   ADR-090 monotone palette lock
//   ADR-091 zoom-aware POI cap (extends ADR-070 per-cat density)
//   ADR-095 centre roundel marker
//   ADR-096 auto-legend in corner
//   ADR-097 integer zoom snap before export
//   ADR-098 typography presets (atomic chip-group)
//
// Each is small enough to live inline; grouping them here keeps the
// module count manageable. Hooked into applyState() the same way
// renderFilters() and applyBgPattern() are — see js/apply.js.
// =====================================================================

// ---- ADR-088 — Title kerning curve by length ------------------------
// Short titles (NYC, ROMA) get airy spacing; long titles
// (CONSTANTINOPLE, FRANKFURT-AM-MAIN) tighten so they fit the poster
// width. Applied via inline style on #caption-title.
function applyTitleKerning() {
  const el = document.getElementById('caption-title');
  if (!el) return;
  const t = (state.caption && state.caption.title) || '';
  // Empirical curve: 14px at 3 chars, 2px at 24 chars, clamped.
  const len = Math.max(1, t.length);
  const ls = Math.max(2, Math.min(14, 14 - len * 0.5));
  el.style.letterSpacing = ls.toFixed(1) + 'px';
}

// ---- ADR-090 — Monotone palette lock --------------------------------
// When state.monotone is true, derive every palette entry from
// state.palette.bg. The user only edits ONE colour and the rest follow
// — water/green/urban/building become darken-by-N variants of bg, and
// the contrast colour (road/label) flips between black/white based on
// bg luminance. Idempotent: rerunning produces the same palette.
function applyMonotone() {
  if (!state.monotone) return;
  const { darken, lighten, lum } = LIB;
  const bg = state.palette && state.palette.bg ? state.palette.bg : '#ffffff';
  const isDark = lum(bg) < 0.5;
  // contrast = the high-luminance colour for roads / labels on this bg
  const contrast = isDark ? '#ffffff' : '#1a1a1a';
  state.palette = {
    bg,
    water:    isDark ? lighten(bg, 0.08) : darken(bg, 0.08),
    green:    isDark ? lighten(bg, 0.04) : darken(bg, 0.04),
    urban:    isDark ? lighten(bg, 0.02) : darken(bg, 0.02),
    building: isDark ? lighten(bg, 0.06) : darken(bg, 0.06),
    roof:     isDark ? lighten(bg, 0.10) : darken(bg, 0.10),
    road:     contrast,
    rail:     isDark ? lighten(bg, 0.30) : darken(bg, 0.30),
    label:    contrast,
    accent:   isDark ? lighten(bg, 0.40) : darken(bg, 0.40),
  };
}

// ---- ADR-091 — Zoom-aware POI cap -----------------------------------
// Wraps the existing refreshPOIs (defined in js/poi.js) with a
// pre-step that scales state.icons.density by current zoom — at low
// zoom the same cap crowds the screen, at high zoom there's room for
// more. Original cap is restored after the call.
const _origRefreshPOIs_zoom = refreshPOIs;
refreshPOIs = function() {
  if (!map || !state.icons) return _origRefreshPOIs_zoom();
  const z = map.getZoom ? map.getZoom() : 14;
  const orig = state.icons.density;
  const scale = z < 14 ? 0.4 : z < 16 ? 0.7 : 1.0;
  state.icons.density = Math.max(3, Math.round(orig * scale));
  try { return _origRefreshPOIs_zoom(); }
  finally { state.icons.density = orig; }
};

// ---- ADR-095 — Centre roundel ---------------------------------------
// A small dot + ring at state.view.center, signalling "this poster is
// about THIS spot". Implemented as a maplibregl.Marker so it tracks
// pan/zoom and rides on the primary map's container.
let _centerRoundelMarker = null;
function applyCenterRoundel() {
  if (typeof map === 'undefined' || !map) return;
  if (state.centerRoundel) {
    if (!_centerRoundelMarker) {
      const el = document.createElement('div');
      el.className = 'center-roundel';
      _centerRoundelMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(state.view && state.view.center ? state.view.center : map.getCenter())
        .addTo(map);
    } else {
      _centerRoundelMarker.setLngLat(state.view && state.view.center ? state.view.center : map.getCenter());
    }
    // Theme: ring colour = palette.accent or palette.label.
    const el = _centerRoundelMarker.getElement();
    if (el) {
      el.style.color = state.palette.accent || state.palette.label || '#1a1a1a';
    }
  } else if (_centerRoundelMarker) {
    _centerRoundelMarker.remove();
    _centerRoundelMarker = null;
  }
}

// ---- ADR-096 — Auto-legend ------------------------------------------
// Tiny SVG legend in the bottom-left of #map-wrap, listing the layers
// currently visible. Updates on every applyState. Uses the live palette
// so it always matches the rendered colours.
function applyLegend() {
  let host = document.getElementById('legendBox');
  if (!state.autoLegend) {
    if (host) host.style.display = 'none';
    return;
  }
  if (!host) {
    host = document.createElement('div');
    host.id = 'legendBox';
    host.className = 'legend-box';
    const wrap = document.getElementById('map-wrap');
    if (wrap) wrap.appendChild(host);
  }
  host.style.display = 'block';
  // Build entries from the visible layers; only show what's actually on.
  const p = state.palette;
  const entries = [];
  if (state.layers.water)     entries.push(['Water',     p.water]);
  if (state.layers.parks || state.layers.greenery) entries.push(['Green', p.green]);
  if (state.layers.buildings) entries.push(['Buildings', p.building]);
  if (state.layers.roads)     entries.push(['Roads',     p.road]);
  if (state.layers.railways)  entries.push(['Rail',      p.rail]);
  // Color the text in palette.label so contrast is automatic.
  host.style.color = p.label;
  host.innerHTML = entries.map(([label, color]) => `
    <span class="legend-row"><span class="legend-swatch" style="background:${color}"></span>${label}</span>
  `).join('');
}

// ---- ADR-097 — Integer zoom snap on export --------------------------
// Hooked into the export click handler. Right before the capture, snap
// the primary map to the nearest integer zoom (or half integer if
// snapping a full zoom would change framing too much) so labels render
// crisp at the high pixelRatio.
function snapZoomForExport() {
  if (typeof map === 'undefined' || !map || typeof map.getZoom !== 'function') return;
  const z = map.getZoom();
  const fullSnap = Math.round(z);
  const halfSnap = Math.round(z * 2) / 2;
  // Use full-integer snap if it's within 0.25 of current zoom; else half.
  const target = Math.abs(z - fullSnap) <= 0.25 ? fullSnap : halfSnap;
  if (Math.abs(z - target) > 0.02) {
    // jumpTo (not easeTo) — synchronous, lands instantly so the export
    // captures the snapped frame without waiting for animation.
    map.jumpTo({ zoom: target });
  }
}

// ---- ADR-098 — Typography presets -----------------------------------
// Atomic chip-group that snaps caption typography fields to designer
// pairings. Each preset sets weight/size/subtitle/coords/ornament/
// divider in one click. CHIP_AFTER hook in dials.js also calls
// applyTypography so the visual updates live.
const TYPOGRAPHY_PRESETS = {
  default:    { titleWeight: 'bold',    titleSize: 'medium', subtitleStyle: 'regular', coordsStyle: 'decimal', titleOrnament: 'none',     captionDivider: 'line' },
  editorial:  { titleWeight: 'heavy',   titleSize: 'large',  subtitleStyle: 'italic',  coordsStyle: 'decimal', titleOrnament: 'dashes',   captionDivider: 'double' },
  modern:     { titleWeight: 'medium',  titleSize: 'large',  subtitleStyle: 'regular', coordsStyle: 'decimal', titleOrnament: 'none',     captionDivider: 'none' },
  vintage:    { titleWeight: 'bold',    titleSize: 'medium', subtitleStyle: 'italic',  coordsStyle: 'dms',     titleOrnament: 'asterisks', captionDivider: 'wave' },
  brutalist:  { titleWeight: 'heavy',   titleSize: 'xl',     subtitleStyle: 'regular', coordsStyle: 'decimal', titleOrnament: 'brackets', captionDivider: 'double' },
  quiet:      { titleWeight: 'regular', titleSize: 'small',  subtitleStyle: 'regular', coordsStyle: 'hidden',  titleOrnament: 'none',     captionDivider: 'none' },
};
function applyTypographyPreset() {
  const preset = TYPOGRAPHY_PRESETS[state.typographyPreset];
  if (!preset) return;
  Object.assign(state, preset);
}
