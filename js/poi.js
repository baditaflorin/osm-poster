// =====================================================================
// OSM Poster — Pinhead icon catalogue + POI overlay
// PRESETS / TEMPLATES list + Pinhead loader + the POI marker layer that
// reads features straight from the loaded vector tiles.
// =====================================================================

// =====================================================================
// PRESETS / TEMPLATES
// Templates are presets that may also dictate frame, border, texture,
// compass, scale — i.e. they reshape the whole poster, not just colors.
// =====================================================================
// PRESETS lives in ./js/presets.js
const PRESETS = PRESET_DATA.PRESETS;


const PRESET_KEYS = Object.keys(PRESETS);
// PALETTE_KEYS, LAYER_*, CITIES, PINHEAD_BASE, ICON_CATEGORIES come from
// DATA (./js/data.js). Adding a new layer/city/category = edit data.js.
const PINHEAD_PICKS = [
  ['Symbols',  'compass',                       'Compass'],
  ['Symbols',  'compass_rose',                  'Compass rose'],
  ['Symbols',  'flag',                          'Flag'],
  ['Symbols',  'flag_checkered',                'Flag checkered'],
  ['Symbols',  'crosshair',                     'Crosshair'],
  ['Symbols',  'jewel',                         'Jewel'],
  ['Travel',   'anchor',                        'Anchor'],
  ['Travel',   'bed',                           'Bed'],
  ['Travel',   'balloon',                       'Balloon'],
  ['Travel',   'parachute',                     'Parachute'],
  ['Travel',   'life_ring',                     'Life ring'],
  ['Travel',   'bridge',                        'Bridge'],
  ['Activity', 'american_football',             'Football'],
  ['Activity', 'bowling_pin_and_bowling_ball',  'Bowling'],
  ['Activity', 'climbing_wall',                 'Climbing'],
  ['Activity', 'golf_green',                    'Golf'],
  ['Activity', 'basketball_in_basketball_net',  'Basketball'],
  ['Activity', 'barbell',                       'Gym'],
  ['Outdoor',  'campfire',                      'Campfire'],
  ['Outdoor',  'cave',                          'Cave'],
  ['Outdoor',  'dam',                           'Dam'],
  ['Outdoor',  'horseshoe',                     'Horseshoe'],
  ['Outdoor',  'cairn',                         'Cairn'],
  ['Outdoor',  'beach_umbrella_in_ground',      'Beach'],
  ['Culture',  'camera',                        'Camera'],
  ['Culture',  'film',                          'Film'],
  ['Culture',  'music_notes_eighth',            'Music'],
  ['Culture',  'palette',                       'Palette'],
  ['Culture',  'newspaper',                     'Newspaper'],
  ['Culture',  'globe',                         'Globe'],
  ['Built',    'arch',                          'Arch'],
  ['Built',    'obelisk',                       'Obelisk'],
  ['Built',    'fountain',                      'Fountain'],
  ['Built',    'lantern',                       'Lantern'],
  ['Built',    'lightbulb',                     'Lightbulb'],
  ['Built',    'envelope',                      'Envelope'],
];
const pinheadCache = new Map();
async function loadPinhead(name) {
  if (pinheadCache.has(name)) return pinheadCache.get(name);
  return Loader.track((async () => {
    try {
      const r = await fetch(PINHEAD_BASE + name + '.svg');
      if (!r.ok) throw new Error(name);
      const svg = await r.text();
      pinheadCache.set(name, svg);
      return svg;
    } catch (e) {
      pinheadCache.set(name, null);
      return null;
    }
  })());
}

// =====================================================================
// POI OVERLAY — render OSM points-of-interest as Pinhead icon markers
// Reads features from the already-loaded vector tiles, no extra fetch.
// =====================================================================
// ICON_CATEGORIES lives in DATA — to add a new POI category, edit data.js.

const CLASS_TO_CATEGORY = (() => {
  const m = {};
  ICON_CATEGORIES.forEach(c => c.classes.forEach(cl => { m[cl] = c; }));
  return m;
})();

function categorizePOI(props) {
  const c = String(props.class || '').toLowerCase();
  const s = String(props.subclass || '').toLowerCase();
  return CLASS_TO_CATEGORY[c] || CLASS_TO_CATEGORY[s] || null;
}

function hasAnyIconCategory() {
  const cats = state.icons && state.icons.categories;
  if (!cats) return false;
  return Object.values(cats).some(Boolean);
}

let poiMarkers = [];
let poiTimer = null;

function clearPOIMarkers() {
  poiMarkers.forEach(m => { try { m.remove(); } catch (e) {} });
  poiMarkers = [];
}

function refreshPOIs() {
  clearTimeout(poiTimer);
  poiTimer = setTimeout(() => safeAsync(async () => {
    clearPOIMarkers();
    if (!hasAnyIconCategory() || map.getZoom() < 13) return;

    let features;
    try { features = map.querySourceFeatures('omt', { sourceLayer: 'poi' }); }
    catch (e) { return; }

    const cats = state.icons.categories;
    const cap  = state.icons.density || 25;
    const size = state.icons.size    || 30;
    // ADR-070 — per-category density override. perCatCaps[key] = how many
    // POIs of that category are allowed before we skip the rest. Missing
    // keys (or 'auto') fall back to the global cap so old saved posters
    // still respect the original single-slider behaviour.
    const densities = (state.icons.densities) || {};
    const catCap = (key) => {
      const v = densities[key];
      return (typeof v === 'number' && v >= 0) ? v : cap;
    };
    const perCatPicked = {};
    const inner = Math.round(size * 0.6);

    // Theme-aware marker chip — derive from active palette so the icons
    // don't look transplanted onto every theme.
    const pal = state.palette;
    const bgLum = lum(pal.bg || '#ffffff');
    // Dark theme → lighter chip; light theme → very subtle off-white from bg.
    const chipBg = bgLum < 0.5 ? lighten(pal.bg, 0.22) : darken(pal.bg, 0.04);
    const ringCol = pal.accent || '#007aff';
    // Icon color: accent on dark chips reads great; on light chips fall
    // back to the label color when accent is too pale to see.
    const accentLum = lum(ringCol);
    const iconCol = (bgLum >= 0.5 && accentLum > 0.7) ? pal.label : ringCol;

    const seen = new Set();
    const picks = [];
    for (const f of features) {
      const cat = categorizePOI(f.properties);
      if (!cat || !cats[cat.key]) continue;
      const name = f.properties.name || f.properties['name:latin'] || '';
      if (!name) continue;
      const coord = f.geometry && f.geometry.coordinates;
      if (!coord || !Array.isArray(coord)) continue;
      const key = name + '|' + coord.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      // Honour per-category cap first (ADR-070), then total cap as a
      // safety net so a generous per-cat dial can't run away.
      const seenCat = perCatPicked[cat.key] || 0;
      if (seenCat >= catCap(cat.key)) continue;
      perCatPicked[cat.key] = seenCat + 1;
      picks.push({ name, coord, props: f.properties, cat });
      if (picks.length >= cap * 4) break;   // hard ceiling at 4x global cap
    }

    for (const f of picks) {
      const svg = await loadPinhead(f.cat.pin);
      if (!svg) continue;
      const el = document.createElement('div');
      el.className = 'poi-marker';
      el.style.width  = size + 'px';
      el.style.height = size + 'px';
      el.style.background = chipBg;
      el.style.borderColor = ringCol;
      el.style.color = iconCol;
      el.title = f.name;
      el.innerHTML = svg;
      const sv = el.querySelector('svg');
      if (sv) {
        sv.setAttribute('width',  inner);
        sv.setAttribute('height', inner);
        sv.style.fill = 'currentColor';
      }
      const m = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(f.coord).addTo(map);
      poiMarkers.push(m);
    }
  }, 'refreshPOIs'), 200);
}
// Note: map.on(...) registrations live near the map init below to
// avoid the temporal-dead-zone trap.
