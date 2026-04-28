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

  function build(s, fallbackPalette) {
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

    if (s.layers.water) {
      layers.push({ id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': p.water, 'fill-antialias': true } });
    }
    if (s.layers.rivers) {
      layers.push({ id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway',
        paint: { 'line-color': p.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 14, 1.5, 18, 4] } });
    }
    if (s.layers.greenery) {
      layers.push({ id: 'lc-wood', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['wood', 'forest']]],
        paint: { 'fill-color': darken(p.green, 0.1), 'fill-opacity': 0.7 } });
      layers.push({ id: 'lc-grass', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland']]],
        paint: { 'fill-color': lighten(p.green, 0.15), 'fill-opacity': 0.5 } });
    }
    if (s.layers.parks) {
      const PARK_OP = { subtle: 0.35, normal: 0.75, bold: 0.95 };
      layers.push({ id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park',
        paint: { 'fill-color': p.green, 'fill-opacity': PARK_OP[s.parkOpacity] || 0.75 } });
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
        const SHAPE_RECIPES = {
          filled:    { color: p.building, op: ['interpolate', ['linear'], ['zoom'], 12, 0.20, 14, 0.85, 18, 0.95], outline: darken(p.building, 0.15) },
          outlined:  { color: p.building, op: ['interpolate', ['linear'], ['zoom'], 12, 0.04, 14, 0.18, 18, 0.22], outline: p.label },
          wireframe: { color: p.building, op: 0, outline: p.accent },
          ghost:     { color: p.building, op: 0.10, outline: p.building },
          bold:      { color: p.building, op: ['interpolate', ['linear'], ['zoom'], 12, 0.5, 14, 0.95, 18, 1.0], outline: p.label },
          invert:    { color: p.bg, op: ['interpolate', ['linear'], ['zoom'], 12, 0.3, 14, 0.85, 18, 0.95], outline: p.accent },
          halftone:  { color: p.building, op: ['interpolate', ['linear'], ['zoom'], 12, 0.10, 14, 0.45, 18, 0.55], outline: darken(p.building, 0.20) },
          accent:    { color: p.accent, op: ['interpolate', ['linear'], ['zoom'], 12, 0.20, 14, 0.85, 18, 0.92], outline: darken(p.accent, 0.15) },
          hairline:  { color: p.building, op: 0, outline: p.label },
        };
        const recipe = SHAPE_RECIPES[shape] || SHAPE_RECIPES.filled;
        layers.push({
          id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 12,
          paint: { 'fill-color': recipe.color, 'fill-opacity': recipe.op, 'fill-outline-color': recipe.outline },
        });
      }
    }

    if (s.layers.industrial) {
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
    if (s.layers.parking) {
      layers.push({ id: 'parking', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['==', ['get', 'class'], 'parking'],
        paint: { 'fill-color': p.urban, 'fill-opacity': 0.55 } });
    }
    if (s.layers.military) {
      layers.push({ id: 'military', type: 'fill', source: 'omt', 'source-layer': 'landuse',
        filter: ['==', ['get', 'class'], 'military'],
        paint: { 'fill-color': '#a04444', 'fill-opacity': 0.18 } });
    }
    if (s.layers.wetlands) {
      layers.push({ id: 'wetland', type: 'fill', source: 'omt', 'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wetland'],
        paint: { 'fill-color': p.water, 'fill-opacity': 0.35, 'fill-outline-color': p.water } });
    }
    if (s.layers.paths) {
      layers.push({ id: 'path', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['path', 'track', 'footway', 'pedestrian', 'bridleway']]],
        minzoom: 12,
        paint: { 'line-color': p.accent, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 18, 1.6], 'line-dasharray': [2, 1.5], 'line-opacity': 0.7 } });
    }
    if (s.layers.cycleways) {
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
    if (s.layers.aerialways) {
      layers.push({ id: 'aerialway', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'aerialway'],
        paint: { 'line-color': p.rail, 'line-width': 0.8, 'line-dasharray': [4, 2], 'line-opacity': 0.85 } });
    }
    if (s.layers.railways) {
      layers.push({ id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]],
        minzoom: 8,
        paint: { 'line-color': p.rail, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 1.2, 18, 2.5], 'line-dasharray': [3, 2] } });
    }

    if (s.layers.roads) {
      const roadClasses = [
        { id: 'minor', match: ['minor', 'service'],  base: 0.6, minzoom: 12 },
        { id: 'tert',  match: ['tertiary'],          base: 1.0, minzoom: 10 },
        { id: 'sec',   match: ['secondary'],         base: 1.4, minzoom: 9  },
        { id: 'pri',   match: ['primary'],           base: 1.8, minzoom: 7  },
        { id: 'trunk', match: ['trunk'],             base: 2.4, minzoom: 6  },
        { id: 'mot',   match: ['motorway'],          base: 3.0, minzoom: 5  },
      ];
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

    if (s.layers.boundaries) {
      layers.push({ id: 'boundary', type: 'line', source: 'omt', 'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 4],
        paint: { 'line-color': p.label, 'line-opacity': 0.18, 'line-width': 0.6, 'line-dasharray': [3, 2] } });
    }

    const labelHalo = haloFor(p.label, p.bg);
    const lcOverride = (s.labelCase === 'uppercase' || s.labelCase === 'lowercase') ? s.labelCase : null;

    if (s.layers.cities) {
      layers.push({ id: 'place-city', type: 'symbol', source: 'omt', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
        layout: { 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']], 'text-font': [s.labelFont],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 12, 12, 18], 'text-letter-spacing': 0.1,
          'text-transform': lcOverride || 'uppercase' },
        paint: { 'text-color': p.label, 'text-halo-color': labelHalo, 'text-halo-width': 2.2, 'text-halo-blur': 0.5 } });
    }
    if (s.layers.neighborhoods) {
      layers.push({ id: 'place-neigh', type: 'symbol', source: 'omt', 'source-layer': 'place',
        minzoom: 10,
        filter: ['in', ['get', 'class'], ['literal', ['village', 'suburb', 'neighbourhood', 'hamlet']]],
        layout: { 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']], 'text-font': [s.labelFont], 'text-size': 12,
          'text-transform': lcOverride || 'none' },
        paint: { 'text-color': p.label, 'text-halo-color': labelHalo, 'text-halo-width': 1.8, 'text-halo-blur': 0.5 } });
    }
    if (s.layers.countries) {
      layers.push({ id: 'place-country', type: 'symbol', source: 'omt', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['country', 'state', 'continent']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': [s.labelFont],
          'text-size': ['interpolate', ['linear'], ['zoom'], 0, 10, 4, 14, 8, 20],
          'text-letter-spacing': 0.2,
          'text-transform': lcOverride || 'uppercase',
        },
        paint: { 'text-color': p.label, 'text-halo-color': labelHalo, 'text-halo-width': 2.5, 'text-halo-blur': 0.5, 'text-opacity': 0.85 } });
    }
    if (s.layers.water_names) {
      layers.push({ id: 'water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': [s.labelFont],
          'text-size': 12, 'text-letter-spacing': 0.15, 'text-transform': lcOverride || 'uppercase',
        },
        paint: { 'text-color': p.water, 'text-halo-color': labelHalo, 'text-halo-width': 1.5, 'text-halo-blur': 0.5, 'text-opacity': 0.85 } });
    }
    if (s.layers.park_names) {
      layers.push({ id: 'park-name', type: 'symbol', source: 'omt', 'source-layer': 'park',
        minzoom: 10,
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': [s.labelFont],
          'text-size': 11, 'text-letter-spacing': 0.1,
          'text-transform': lcOverride || 'none',
        },
        paint: { 'text-color': p.label, 'text-halo-color': labelHalo, 'text-halo-width': 1.4, 'text-halo-blur': 0.5, 'text-opacity': 0.8 } });
    }
    if (s.layers.streets) {
      layers.push({ id: 'street-name', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name',
        minzoom: 14, filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'tertiary', 'minor']]],
        layout: { 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']], 'text-font': [s.labelFont], 'text-size': 11, 'symbol-placement': 'line',
          'text-transform': lcOverride || 'none' },
        paint: { 'text-color': p.label, 'text-halo-color': labelHalo, 'text-halo-width': 1.8, 'text-halo-blur': 0.5 } });
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
        },
        paint: { 'text-color': p.label, 'text-halo-color': labelHalo, 'text-halo-width': 1.4 } });
    }

    return {
      version: 8,
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
      layers,
    };
  }

  return { build };
})();
