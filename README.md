# OSM Poster

Beautiful map posters from OpenStreetMap, generated entirely in your browser.
No backend, no API keys, no signups — just open the page and design.

**Live demo:** https://baditaflorin.github.io/osm-poster/

## Features

- Search any place in the world (Nominatim)
- 4 vector tile styles: Minimal, Bright, Liberty, Dark
- 3 frames: Portrait, Square, Landscape
- Live caption with title, subtitle, and auto-updating coordinates
- Export as high-resolution PNG (4× pixel ratio, suitable for printing)

## Stack

- [MapLibre GL JS](https://maplibre.org/) — vector map rendering
- [OpenFreeMap](https://openfreemap.org/) — free vector tiles, no API key
- [Nominatim](https://nominatim.openstreetmap.org/) — geocoding
- [html-to-image](https://github.com/bubkoo/html-to-image) — PNG export

## Local development

It's a single static HTML file. Open it directly:

```bash
open index.html
```

Or serve with anything:

```bash
python3 -m http.server 8000
```

## Deploy

Pushed to the `main` branch and served via GitHub Pages from the repo root.

## Credits

Map data © [OpenStreetMap](https://openstreetmap.org/copyright) contributors.
Tiles served by [OpenFreeMap](https://openfreemap.org/).
