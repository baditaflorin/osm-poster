# OSM Poster

Beautiful, custom-styled map posters from OpenStreetMap, generated entirely
in your browser. No backend, no API keys, no signups.

**Live demo:** https://baditaflorin.github.io/osm-poster/

## Features

- 11 hand-designed style presets (Blueprint, Vintage, Parchment, Tron, …)
- 12 toggleable OSM data layers (water, rivers, parks, greenery, buildings,
  industrial, railways, paths, airports, place names, streets, POIs)
- 9-swatch palette with live color picking, layer-aware halo logic
- Map rotation + 3D pitch (auto-extrudes buildings when tilted)
- Center marker (pin / heart / star / dot) — anchored geographically
- GPX route overlay (drag a .gpx file onto the map)
- Compass rose, scale bar, paper grain / halftone overlays
- 4 frame border styles, 6 aspect ratios (Portrait / Square / Landscape /
  Story / A4 / Banner)
- Commemorative mode for weddings, anniversaries, new homes
- Seedable randomize for reproducible palettes
- Export: PNG, SVG, or print-ready PDF in screen / A2 / A3 / A4 / 4K sizes
- Shareable URL (state encoded in hash) + localStorage autosave
- Undo / redo history (⌘Z / ⌘⇧Z)
- Keyboard shortcuts (`R` randomize, `E` export, `[` `]` cycle presets,
  `M` toggle marker, `?` help, `F` fullscreen)

## How it works

We author the MapLibre style JSON ourselves — every layer, color, road
weight, and label is generated in the browser from your `state`. The map
*data* (water polygons, road lines, building footprints, POIs) comes from
OpenFreeMap's free vector tiles; everything visual is ours.

See [docs/ADRS.md](docs/ADRS.md) for the architectural decisions behind
each feature.

## Stack

- [MapLibre GL JS](https://maplibre.org/) — vector rendering, 3D, sources
- [OpenFreeMap](https://openfreemap.org/) — free vector tiles, no API key
- [Nominatim](https://nominatim.openstreetmap.org/) — geocoding
- [html-to-image](https://github.com/bubkoo/html-to-image) — PNG/SVG export
- [jsPDF](https://github.com/parallax/jsPDF) — lazy-loaded for PDF export

## Local development

Single static HTML file. Serve with anything:

```bash
python3 -m http.server 8000
```

## Credits

Map data © [OpenStreetMap](https://openstreetmap.org/copyright) contributors.
Vector tiles by [OpenFreeMap](https://openfreemap.org/).
