// =====================================================================
// OSM Poster — MapLibre style generator
// Pure function: takes state + fallback palette, returns a complete
// MapLibre style spec. No DOM, no side effects.
//
// Adding a new layer renderer = drop another `if (s.layers.X) layers.push(...)`
// block here, and add the key to LAYER_ORDER + LAYER_LABELS in data.js.
// =====================================================================
window.STYLE = (function () {
  const { darken, lighten, haloFor, dashFor } = window.LIB;

  // For Photoshop-style per-layer blending we render the map in 3 stacked
  // MapLibre instances ("bg" / "buildings" / "fg"). Each instance gets a
  // partial style spec — same source, but only the layers that belong to
  // its group. group(id) classifies a layer ID into one of these.
  function group(id) {
    if (id === 'bg') return 'bg';
    if (id === 'building' || id === 'building-3d' ||
        id === 'building-3d-fallback' || id === 'building-outline' ||
        id === 'building-fallback') return 'buildings';
    if (id.startsWith('road-') || id === 'rail' ||
        id === 'path' || id === 'cycleway' || id === 'aerialway' ||
        id === 'boundary' ||
        id.startsWith('place-') ||
        id === 'water-name' || id === 'park-name' ||
        id === 'street-name' || id === 'peak') return 'fg';
    return 'bg';
  }

  // build(s, fallbackPalette, opts?)
  // opts.group  — optional 'bg' | 'buildings' | 'fg' filter. If set, only
  //               that group's layers are returned. Drops the canvas
  //               background-color layer for non-bg groups so those
  //               instances render on a transparent canvas and stack
  //               cleanly via CSS.
  // ADR-081 — Density dial. Each layer key has a "minimum density at
  // which it still renders". Slider sliding left below that threshold
  // hides the layer regardless of state.layers.X. Roads are special-
  // cased below — at low density we filter to only major classes.
  const DENSITY_MIN = {
    pois:           80,
    street_label:   80,
    neighborhoods:  60,
    industrial:     60,
    parking:        60,
    military:       60,
    park_name:      60,
    water_name:     50,
    buildings:      40,
    cycleways:      40,
    paths:          40,
    aerialways:     40,
    rivers:         20,
    rail:           20,
    boundaries:     30,
    park:           20,
    greenery:       30,
    // water + motorway-class roads + bg + cities + countries are always
    // shown (they're the floor of "still recognisable as a map").
  };
  function densityAllows(s, key) {
    const d = (typeof s.density === 'number') ? s.density : 100;
    const min = DENSITY_MIN[key];
    if (min == null) return true;       // not gated
    return d > min;                      // strictly greater so density=80 hides street_label cleanly
  }

  // ADR-082 — Road hierarchy ramps. Each entry is the per-class width
  // multiplier; the existing `base * w` formula consumes it. 'firm' is
  // today's behaviour; 'extreme' gives the MapToPoster-style strong
  // motorway/minor contrast.
  const ROAD_HIERARCHY = {
    flat:    { minor: 1.0, tert: 1.0, sec: 1.0, pri: 1.0, trunk: 1.0, mot: 1.0 },
    soft:    { minor: 1.0, tert: 1.1, sec: 1.2, pri: 1.3, trunk: 1.4, mot: 1.5 },
    firm:    { minor: 0.6, tert: 1.0, sec: 1.4, pri: 1.8, trunk: 2.4, mot: 3.0 },
    strong:  { minor: 0.5, tert: 0.9, sec: 1.4, pri: 2.0, trunk: 3.0, mot: 4.0 },
    extreme: { minor: 0.3, tert: 0.6, sec: 1.2, pri: 2.4, trunk: 4.0, mot: 8.0 },
  };

  // ADR-084 — Label priority. Lower number = drawn first = wins
  // overlap. Used as symbol-sort-key so MapLibre's collision detection
  // picks the right loser when two labels would overlap.
  const LABEL_PRIORITY = {
    'place-country': 1,
    'place-city':    2,
    'place-neigh':   3,
    'water-name':    4,
    'park-name':     5,
    'street-name':   6,
    'peak':          7,
  };

  // ADR-085 — Halo width = constant share of text-size. Computed from
  // the same zoom-interp that the layer's text-size uses, so halo
  // tracks size automatically. Not a flat number anymore.
  function haloFor_size(textSize) {
    return Math.max(1.2, textSize * 0.18);
  }

  function build(s, fallbackPalette, opts) {
    const filterGroup = opts && opts.group;
    const layers = [];
    const w = (typeof s.roadWeight === 'number' && s.roadWeight > 0) ? s.roadWeight : 1;
    // Defensive palette: missing/invalid keys fall back to Blueprint's value.
    const p = new Proxy(s.palette || {}, {
      get(t, k) {
        const v = t[k];
        return (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v)) ? v : (fallbackPalette[k] || '#888888');
      },
    });
    layers.push({ id: 'bg', type: 'background', paint: { 'background-color': p.bg } });

    // Standard map convention: land features (greenery/parks) FIRST, then
    // water on top, so rivers cut cleanly through park polygons even where
    // OMT's park feature spills slightly over the riverbank (which is why
    // Watercolor used to render the Seine in sage green — the park layer
    // was painting over the water layer below it). Order now matches the
    // OpenStreetMap default style.
    if (s.layers.greenery && densityAllows(s, 'greenery')) {
      layers.push({ id: 'lc-wood', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['wood', 'forest']]],
        paint: { 'fill-color': darken(p.green, 0.1), 'fill-opacity': 0.7 } });
      layers.push({ id: 'lc-grass', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland']]],
        paint: { 'fill-color': lighten(p.green, 0.15), 'fill-opacity': 0.5 } });
    }
    if (s.layers.parks && densityAllows(s, 'park')) {
      const PARK_OP = { subtle: 0.35, normal: 0.75, bold: 0.95 };
      // ADR-092 — Park edge softening: blurred outer halo around park
      // polygons before the fill, so the fill edge fades into surroundings.
      if (s.parkSoften) {
        layers.push({ id: 'park-halo', type: 'line', source: 'omt', 'source-layer': 'park',
          paint: { 'line-color': p.green, 'line-width': 14, 'line-blur': 10, 'line-opacity': 0.30 } });
      }
      layers.push({ id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park',
        paint: { 'fill-color': p.green, 'fill-opacity': PARK_OP[s.parkOpacity] || 0.75 } });
    }
    if (s.layers.water) {
      layers.push({ id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': p.water, 'fill-antialias': true } });
      // ADR-089 — Coastline emphasis. Optional darker line on the water
      // polygon edge so coast doesn't disappear when water and land
      // share similar luminance (pastel themes).
      if (s.coastLine) {
        layers.push({ id: 'water-coast', type: 'line', source: 'omt', 'source-layer': 'water',
          paint: { 'line-color': darken(p.water, 0.25), 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 12, 1.0, 18, 1.6], 'line-opacity': 0.8 } });
      }
    }
    if (s.layers.rivers && densityAllows(s, 'rivers')) {
      layers.push({ id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway',
        // ADR-083 — minzoom 8: rivers are noise below city zoom.
        minzoom: 8,
        paint: { 'line-color': p.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 14, 1.5, 18, 4] } });
    }

    // 3D extruded buildings draw AFTER roads (collected here, pushed below).
    let building3D = null;
    if (s.layers.buildings) {
      layers.push({ id: 'building-fallback', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'suburb', 'neighbourhood']]],
        maxzoom: 13.5,
        paint: { 'fill-color': p.urban, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 11, 0.75, 13.5, 0.4] } });

      if (s.pitch > 8) {
        const hMul = (typeof s.buildingHeight === 'number' && s.buildingHeight > 0) ? s.buildingHeight : 1;
        const roofBase = p.roof || p.building;
        const roofTone = s.roofTone || 'match';
        const roofBaseColor =
          roofTone === 'lighter' ? lighten(p.building, 0.18) :
          roofTone === 'darker'  ? darken(p.building, 0.18) :
          roofTone === 'accent'  ? p.accent :
          roofTone === 'custom'  ? roofBase :
          /* match */              p.building;
        const useGradient = s.buildingShading !== false;
        const shape3D = s.buildingShape || 'filled';
        const SHAPE_3D = {
          filled:    { c: roofBaseColor, op: 0.95 },
          outlined:  { c: roofBaseColor, op: 0.40 },
          wireframe: { c: roofBaseColor, op: 0.15 },
          ghost:     { c: roofBaseColor, op: 0.25 },
          bold:      { c: roofBaseColor, op: 1.00 },
          invert:    { c: p.bg,           op: 0.90 },
          halftone:  { c: roofBaseColor, op: 0.50 },
          accent:    { c: p.accent,       op: 0.95 },
          hairline:  { c: roofBaseColor, op: 0.10 },
        };
        const r3 = SHAPE_3D[shape3D] || SHAPE_3D.filled;
        const roofColor = r3.c;
        const op3 = r3.op;
        layers.push({
          id: 'building-3d-fallback', type: 'fill-extrusion', source: 'omt', 'source-layer': 'landuse',
          filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'suburb', 'neighbourhood', 'industrial']]],
          minzoom: 8, maxzoom: 13.2,
          paint: {
            'fill-extrusion-color': roofColor,
            'fill-extrusion-vertical-gradient': useGradient,
            'fill-extrusion-height': 60 * hMul,
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.55 * op3, 12, 0.85 * op3, 13.2, 0],
          },
        });
        building3D = { id: 'building-3d', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 12,
          paint: {
            'fill-extrusion-color': roofColor,
            'fill-extrusion-vertical-gradient': useGradient,
            'fill-extrusion-height': ['*', ['coalesce', ['get', 'render_height'], 8], hMul],
            'fill-extrusion-base':   ['*', ['coalesce', ['get', 'render_min_height'], 0], hMul],
            'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 13.2, op3],
          } };
      } else {
        const shape = s.buildingShape || 'filled';
        // strokeOnly: true means "fill is invisible, all the visual lives
        // in the outline" — we push a separate line layer for those modes
        // because MapLibre folds fill-outline-color into fill-opacity, so
        // op:0 hides the outline along with the fill.
        const SHAPE_RECIPES = {
          filled:    { color: p.building, op: ['interpolate', ['linear'], ['zoom'], 12, 0.20, 14, 0.85, 18, 0.95], outline: darken(p.building, 0.15) },
          outlined:  { color: p.building, op: ['interpolate', ['linear'], ['zoom'], 12, 0.04, 14, 0.18, 18, 0.22], outline: p.label },
          wireframe: { color: p.building, op: 0, outline: p.accent, strokeOnly: true, strokeWidth: 0.6, strokeOpacity: 0.85 },
          ghost:     { color: p.building, op: 0.10, outline: p.building },
          bold:      { color: p.building, op: ['interpolate', ['linear'], ['zoom'], 12, 0.5, 14, 0.95, 18, 1.0], outline: p.label },
          invert:    { color: p.bg, op: ['interpolate', ['linear'], ['zoom'], 12, 0.3, 14, 0.85, 18, 0.95], outline: p.accent },
          halftone:  { color: p.building, op: ['interpolate', ['linear'], ['zoom'], 12, 0.10, 14, 0.45, 18, 0.55], outline: darken(p.building, 0.20) },
          accent:    { color: p.accent, op: ['interpolate', ['linear'], ['zoom'], 12, 0.20, 14, 0.85, 18, 0.92], outline: darken(p.accent, 0.15) },
          hairline:  { color: p.building, op: 0, outline: p.label, strokeOnly: true, strokeWidth: 0.4, strokeOpacity: 0.9 },
        };
        const recipe = SHAPE_RECIPES[shape] || SHAPE_RECIPES.filled;
        layers.push({
          id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 12,
          paint: { 'fill-color': recipe.color, 'fill-opacity': recipe.op, 'fill-outline-color': recipe.outline },
        });
        if (recipe.strokeOnly) {
          layers.push({
            id: 'building-outline', type: 'line', source: 'omt', 'source-layer': 'building', minzoom: 12,
            paint: { 'line-color': recipe.outline, 'line-width': recipe.strokeWidth, 'line-opacity': recipe.strokeOpacity },
          });
        }
      }
    }

    if (s.layers.industrial && densityAllows(s, 'industrial')) {
      layers.push({ id: 'industrial', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['industrial', 'railway']]],
        paint: { 'fill-color': darken(p.urban, 0.15), 'fill-opacity': 0.7 } });
    }
    if (s.layers.airports) {
      layers.push({ id: 'air-area', type: 'fill', source: 'omt', 'source-layer': 'aeroway',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': lighten(p.urban, 0.05), 'fill-opacity': 0.6 } });
      layers.push({ id: 'air-runway', type: 'line', source: 'omt', 'source-layer': 'aeroway',
        filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', ['runway', 'taxiway']]]],
        paint: { 'line-color': p.road, 'line-width': ['case', ['==', ['get', 'class'], 'runway'], 4, 1.5] } });
    }
    if (s.layers.parking && densityAllows(s, 'parking')) {
      layers.push({ id: 'parking', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['==', ['get', 'class'], 'parking'],
        paint: { 'fill-color': p.urban, 'fill-opacity': 0.55 } });
    }
    if (s.layers.military && densityAllows(s, 'military')) {
      layers.push({ id: 'military', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['==', ['get', 'class'], 'military'],
        paint: { 'fill-color': '#a04444', 'fill-opacity': 0.18 } });
    }
    if (s.layers.wetlands) {
      layers.push({ id: 'wetland', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wetland'],
        paint: { 'fill-color': p.water, 'fill-opacity': 0.35, 'fill-outline-color': p.water } });
    }
    if (s.layers.paths && densityAllows(s, 'paths')) {
      layers.push({ id: 'path', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['path', 'track', 'footway', 'pedestrian', 'bridleway']]],
        minzoom: 12,
        paint: { 'line-color': p.accent, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 18, 1.6], 'line-dasharray': [2, 1.5], 'line-opacity': 0.7 } });
    }
    if (s.layers.cycleways && densityAllows(s, 'cycleways')) {
      layers.push({ id: 'cycleway', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'cycleway'],
        minzoom: 12,
        paint: { 'line-color': p.accent, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 18, 2.4], 'line-dasharray': [3, 1.5], 'line-opacity': 0.9 } });
    }
    if (s.layers.ferries) {
      layers.push({ id: 'ferry', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'ferry'],
        paint: { 'line-color': p.accent, 'line-width': 1.2, 'line-dasharray': [3, 3], 'line-opacity': 0.7 } });
    }
    if (s.layers.piers) {
      layers.push({ id: 'pier', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'pier'],
        paint: { 'line-color': p.label, 'line-width': 1.2, 'line-opacity': 0.7 } });
    }
    if (s.layers.aerialways && densityAllows(s, 'aerialways')) {
      layers.push({ id: 'aerialway', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'aerialway'],
        paint: { 'line-color': p.rail, 'line-width': 0.8, 'line-dasharray': [4, 2], 'line-opacity': 0.85 } });
    }
    if (s.layers.railways && densityAllows(s, 'rail')) {
      layers.push({ id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]],
        minzoom: 8,
        paint: { 'line-color': p.rail, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 1.2, 18, 2.5], 'line-dasharray': [3, 2] } });
    }

    if (s.layers.roads) {
      // ADR-082 — class-specific weight from the roadHierarchy ramp.
      const ramp = ROAD_HIERARCHY[s.roadHierarchy] || ROAD_HIERARCHY.firm;
      // ADR-081 — at low density, skip the lower classes entirely.
      // density >  60: all classes
      // density 41..60: drop minor + service
      // density 21..40: also drop tertiary
      // density <= 20:  motorway + trunk + primary only
      const density = (typeof s.density === 'number') ? s.density : 100;
      const allClasses = [
        { id: 'minor', match: ['minor', 'service'],  base: ramp.minor, minzoom: 12 },
        { id: 'tert',  match: ['tertiary'],          base: ramp.tert,  minzoom: 10 },
        { id: 'sec',   match: ['secondary'],         base: ramp.sec,   minzoom: 9  },
        { id: 'pri',   match: ['primary'],           base: ramp.pri,   minzoom: 7  },
        { id: 'trunk', match: ['trunk'],             base: ramp.trunk, minzoom: 6  },
        { id: 'mot',   match: ['motorway'],          base: ramp.mot,   minzoom: 5  },
      ];
      const roadClasses = allClasses.filter(rc => {
        if (density <= 20)  return ['mot', 'trunk', 'pri'].includes(rc.id);
        if (density <= 40)  return rc.id !== 'minor' && rc.id !== 'tert';
        if (density <= 60)  return rc.id !== 'minor';
        return true;
      });
      const dash = dashFor(s.roadStyle);
      if (s.roadCasing) {
        roadClasses.forEach(rc => {
          layers.push({
            id: 'road-casing-' + rc.id, type: 'line', source: 'omt', 'source-layer': 'transportation',
            filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', rc.match]]],
            minzoom: rc.minzoom,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': p.bg,
              'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 5, rc.base * w * 0.35, 12, rc.base * w * 1.6, 18, rc.base * w * 6.8],
            },
          });
        });
      }
      const capChoice = (s.roadCaps === 'butt' || s.roadCaps === 'square') ? s.roadCaps : 'round';
      roadClasses.forEach(rc => {
        const layer = {
          id: 'road-' + rc.id, type: 'line', source: 'omt', 'source-layer': 'transportation',
          filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', rc.match]]],
          minzoom: rc.minzoom,
          layout: { 'line-cap': dash ? 'butt' : capChoice, 'line-join': 'round' },
          paint: {
            'line-color': p.road,
            'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 5, rc.base * w * 0.15, 12, rc.base * w * 0.9, 18, rc.base * w * 4.5],
          },
        };
        if (dash) layer.paint['line-dasharray'] = dash;
        if (s.roadGlow) layer.paint['line-blur'] = 2.5;
        layers.push(layer);
      });
    }

    if (building3D) layers.push(building3D);

    if (s.layers.boundaries && densityAllows(s, 'boundaries')) {
      layers.push({ id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 4],
        paint: { 'line-color': p.label, 'line-opacity': 0.18, 'line-width': 0.6, 'line-dasharray': [3, 2] } });
    }

    const labelHalo = haloFor(p.label, p.bg);
    const lcOverride = (s.labelCase === 'uppercase' || s.labelCase === 'lowercase') ? s.labelCase : null;
    // ADR-084 + ADR-085 + ADR-099 — every label layer gets:
    //   * text-allow-overlap + text-ignore-placement = false (defaults but
    //     spelled out here so it's clear these collide with each other)
    //   * symbol-sort-key from LABEL_PRIORITY so the high-priority class
    //     wins the collision (cities beat neighborhoods beat streets, etc.)
    //   * text-halo-width that scales with text-size (~0.18×) instead of
    //     a fixed value, so big labels get strong halos and small labels
    //     don't look encrusted
    //   * cities/countries text-size driven by OMT's `rank` property so
    //     the label hierarchy reflects place importance

    if (s.layers.cities) {
      // ADR-099 — rank-based size: rank 1 (capitals) = 22, rank 10 (small towns) = 10.
      // ['coalesce'] guards against missing rank in older tiles.
      const citySize = ['interpolate', ['linear'], ['coalesce', ['get', 'rank'], 5], 1, 22, 6, 14, 10, 10];
      layers.push({ id: 'place-city', type: 'symbol', source: 'omt', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
        layout: { 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']], 'text-font': [s.labelFont],
          'text-size': citySize, 'text-letter-spacing': 0.1,
          'text-transform': lcOverride || 'uppercase',
          'text-allow-overlap': false, 'text-ignore-placement': false,
          'symbol-sort-key': LABEL_PRIORITY['place-city'] },
        paint: { 'text-color': p.label, 'text-halo-color': labelHalo,
          'text-halo-width': ['*', citySize, 0.18], 'text-halo-blur': 0.5 } });
    }
    if (s.layers.neighborhoods) {
      const neighSize = ['interpolate', ['linear'], ['coalesce', ['get', 'rank'], 5], 1, 14, 6, 11, 10, 9];
      layers.push({ id: 'place-neigh', type: 'symbol', source: 'omt', 'source-layer': 'place',
        minzoom: 10,
        filter: ['in', ['get', 'class'], ['literal', ['village', 'suburb', 'neighbourhood', 'hamlet']]],
        layout: { 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']], 'text-font': [s.labelFont], 'text-size': neighSize,
          'text-transform': lcOverride || 'none',
          'text-allow-overlap': false, 'text-ignore-placement': false,
          'symbol-sort-key': LABEL_PRIORITY['place-neigh'] },
        paint: { 'text-color': p.label, 'text-halo-color': labelHalo,
          'text-halo-width': ['*', neighSize, 0.18], 'text-halo-blur': 0.5 } });
    }
    if (s.layers.countries) {
      const countrySize = ['interpolate', ['linear'], ['zoom'], 0, 10, 4, 14, 8, 20];
      layers.push({ id: 'place-country', type: 'symbol', source: 'omt', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['country', 'state', 'continent']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': [s.labelFont],
          'text-size': countrySize,
          'text-letter-spacing': 0.2,
          'text-transform': lcOverride || 'uppercase',
          'text-allow-overlap': false, 'text-ignore-placement': false,
          'symbol-sort-key': LABEL_PRIORITY['place-country'],
        },
        paint: { 'text-color': p.label, 'text-halo-color': labelHalo,
          'text-halo-width': ['*', countrySize, 0.18], 'text-halo-blur': 0.5, 'text-opacity': 0.85 } });
    }
    if (s.layers.water_names && densityAllows(s, 'water_name')) {
      layers.push({ id: 'water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': [s.labelFont],
          'text-size': 12, 'text-letter-spacing': 0.15, 'text-transform': lcOverride || 'uppercase',
          'text-allow-overlap': false, 'text-ignore-placement': false,
          'symbol-sort-key': LABEL_PRIORITY['water-name'],
        },
        paint: { 'text-color': p.water, 'text-halo-color': labelHalo,
          'text-halo-width': haloFor_size(12), 'text-halo-blur': 0.5, 'text-opacity': 0.85 } });
    }
    if (s.layers.park_names && densityAllows(s, 'park_name')) {
      layers.push({ id: 'park-name', type: 'symbol', source: 'omt', 'source-layer': 'park',
        minzoom: 10,
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': [s.labelFont],
          'text-size': 11, 'text-letter-spacing': 0.1,
          'text-transform': lcOverride || 'none',
          'text-allow-overlap': false, 'text-ignore-placement': false,
          'symbol-sort-key': LABEL_PRIORITY['park-name'],
        },
        paint: { 'text-color': p.label, 'text-halo-color': labelHalo,
          'text-halo-width': haloFor_size(11), 'text-halo-blur': 0.5, 'text-opacity': 0.8 } });
    }
    if (s.layers.streets && densityAllows(s, 'street_label')) {
      layers.push({ id: 'street-name', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name',
        minzoom: 14, filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'tertiary', 'minor']]],
        layout: { 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']], 'text-font': [s.labelFont], 'text-size': 11, 'symbol-placement': 'line',
          'text-transform': lcOverride || 'none',
          'text-allow-overlap': false, 'text-ignore-placement': false,
          'symbol-sort-key': LABEL_PRIORITY['street-name'] },
        paint: { 'text-color': p.label, 'text-halo-color': labelHalo,
          'text-halo-width': haloFor_size(11), 'text-halo-blur': 0.5 } });
    }
    if (s.layers.peaks) {
      layers.push({ id: 'peak', type: 'symbol', source: 'omt', 'source-layer': 'mountain_peak',
        minzoom: 9,
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': [s.labelFont],
          'text-size': 11,
          'text-offset': [0, 0.6],
          'text-transform': lcOverride || 'none',
          'text-allow-overlap': false, 'text-ignore-placement': false,
          'symbol-sort-key': LABEL_PRIORITY['peak'],
        },
        paint: { 'text-color': p.label, 'text-halo-color': labelHalo,
          'text-halo-width': haloFor_size(11) } });
    }

    const finalLayers = filterGroup
      ? layers.filter(l => group(l.id) === filterGroup)
      : layers;

    return {
      version: 8,
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
      layers: finalLayers,
    };
  }

  return { build, group };
})();
