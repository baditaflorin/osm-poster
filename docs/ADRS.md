# Architecture Decision Records

Twenty decisions that take OSM Poster from "basemap printer" to a tool that
actually feels magical to use. Each ADR captures **why** we made the choice
so future changes don't accidentally undo the reasoning.

Format: **Context → Decision → Consequences**.

---

## ADR-001 — URL hash state, no backend

**Context.** A user designs a beautiful map, wants to share it. Without
shareable state we'd need a backend (saving, IDs, auth) — we don't have one
and don't want one.

**Decision.** Encode the entire poster state (place, zoom, bearing, pitch,
preset, palette, layers, frame, caption) into the URL hash as
`btoa(encodeURIComponent(JSON.stringify(state)))`. On load, decode and
restore. Update the hash on every state change (debounced).

**Consequences.** Sharing is just "copy the URL". No accounts, no DB. Hash
length grows with palette diversity but stays well under 4 KB even for fully
custom states. URL is opaque (base64), trade-off accepted for compactness.

---

## ADR-002 — localStorage autosave for last-used state

**Context.** A user closes the tab mid-design. They reopen the app and
their work is gone — frustrating.

**Decision.** Persist the current state to `localStorage` under
`osm-poster:last`. On load, if there is no URL hash but a saved state
exists, restore it. URL hash always wins over localStorage (explicit share
beats implicit memory).

**Consequences.** Zero work lost across sessions. localStorage is per-origin
so each deployment has independent memory. No PII stored — just a design.

---

## ADR-003 — Decorative compass rose overlay (SVG)

**Context.** Beautiful printed maps almost always have a compass rose. It
turns a basemap into a decorative artifact.

**Decision.** Render an SVG compass rose as a positioned overlay on top of
the map. Toggleable. Three corner positions: TL, TR, BR. Color derived from
the active palette's `label` color so it matches every preset.

**Consequences.** Pure DOM/SVG, no MapLibre layer needed (rotates with the
poster, not with the map bearing — which is what users want). Captured
correctly by `html-to-image` because it's part of the poster DOM.

---

## ADR-004 — Built-in scale bar

**Context.** A scale bar is a small detail that signals "this is a real map,
not a stylized illustration".

**Decision.** Use MapLibre's built-in `ScaleControl` positioned in the
poster's bottom-left, toggleable. Metric by default.

**Consequences.** Free, accurate, automatically updates with zoom. One
line of code per preset.

---

## ADR-005 — Map rotation control

**Context.** Some cities (Manhattan, Barcelona's Eixample) only look right
when rotated to align their dominant axis. Square posters benefit from
diagonal compositions.

**Decision.** Expose a bearing slider (-180° to 180°) bound to
`map.setBearing()`. Persist bearing in URL hash and localStorage.

**Consequences.** Bearing must be re-applied after every `setStyle()` call
(it does not survive style swaps). Add to the existing `restyle()` helper.

---

## ADR-006 — Map pitch / 3D tilt

**Context.** A subtle pitch (10-30°) gives posters depth and lets buildings
read as 3D extrusions.

**Decision.** Pitch slider 0-60°, paired with the rotation control. When
pitch > 0 and `Buildings` is on, optionally extrude buildings using
`fill-extrusion` instead of flat `fill`.

**Consequences.** Building extrusion needs `building:height` or
`building:levels` data; OpenMapTiles provides `render_height`. When
unavailable we fall back to flat fill — no error, just no 3D.

---

## ADR-007 — Frame border styles

**Context.** Posters benefit from a visible frame; also helps when printed
with white border.

**Decision.** Four frame styles via CSS class: `none`, `thin`, `double`,
`bold`. Color uses palette `label`.

**Consequences.** Pure CSS, captured by `html-to-image`. No impact on map
performance.

---

## ADR-008 — Center marker (pin, heart, star, dot)

**Context.** "Where I grew up", "where we got married", "where I lived" —
all need a marker at a specific point. Map alone is ambiguous.

**Decision.** SVG marker overlay anchored at the map's center coordinate
(not the screen center — it stays geographically anchored on pan). Four
icon options. Color from palette `accent`. Toggleable.

**Consequences.** Implemented via a MapLibre `Marker` with an HTML element.
Marker survives style swaps automatically. SVG icons are inline, no asset
loading.

---

## ADR-009 — GPX upload, route overlay

**Context.** "Draw your run/ride/hike on a map" is the single highest-virality
use case. It's why Mapiful and Strava-poster sites exist.

**Decision.** Drag/click a GPX file. Parse `<trkpt>`, `<rtept>`, `<wpt>` in
the browser using `DOMParser`. Add as a GeoJSON source + line layer with
the palette `accent` color. Auto-fit bounds to the route.

**Consequences.** Browser-only — files never leave the user's machine.
Re-add the source after every `setStyle()` (style swaps wipe sources).

---

## ADR-010 — Anniversary / commemorative mode

**Context.** A common use case is "wedding map", "first date map",
"new home map" — a date and two names matter as much as the map itself.

**Decision.** A toggle that swaps the caption block layout: title becomes
two names (`A & B`), subtitle becomes a date. Adds an em-rule between the
names and a long-date format.

**Consequences.** Pure DOM toggle. State persisted with the rest of the
caption fields.

---

## ADR-011 — Multiple export aspect ratios

**Context.** Print posters need A-series sizes; social posts need square or
vertical (Story).

**Decision.** Aspect ratio dropdown in the export controls: A2 / A3 / A4 /
Square (1:1) / Story (9:16) / Banner (3:1). Frame switches accordingly.
Pixel ratio scales to keep ≥300 DPI for print sizes and ≥4× for screen.

**Consequences.** Resize triggers `map.resize()` to keep the map filling the
new aspect. Rendering stays sharp because we use vector tiles.

---

## ADR-012 — SVG export (vector)

**Context.** PNG is fine for print, but vector is better for editing in
Illustrator/Affinity, and infinitely scalable.

**Decision.** Add `Export SVG` option using `html-to-image.toSvg()`. The
map raster gets embedded inside the SVG (still rastery for the map portion),
but caption/borders remain editable vectors.

**Consequences.** SVG file is larger than PNG. Map portion is base64
PNG-in-SVG (acceptable trade-off given browser canvas limits).

---

## ADR-013 — Print-ready PDF export

**Context.** Many users want to send a poster to a print shop.

**Decision.** Lazy-load `jsPDF` from CDN on first PDF export. Render to PNG
at the chosen aspect's pixel dimensions, embed in a PDF page sized to A2/A3/A4.

**Consequences.** First PDF export has a one-time ~50KB library load. PDF is
a single page, fonts come along as raster.

---

## ADR-014 — Paper grain / film texture overlay

**Context.** What separates "pretty digital map" from "framed art" is
texture. Mapiful's posters look printed because they have a subtle paper
grain.

**Decision.** Three overlay textures: `none`, `grain` (subtle SVG noise),
`halftone` (CSS dot pattern). Implemented as a positioned `mix-blend-mode:
multiply` div over the map.

**Consequences.** Pure CSS/SVG — no asset loading. Captured by html-to-image.

---

## ADR-015 — Keyboard shortcuts

**Context.** Power users iterate fast. Clicking through menus is slow.

**Decision.** Bind: `R` randomize palette, `E` export PNG, `F` toggle
fullscreen preview, `?` open help, `[`/`]` cycle presets, `M` toggle marker,
`Esc` close modal, `Cmd/Ctrl+Z` undo, `Cmd/Ctrl+Shift+Z` redo. Ignore
shortcuts when an input is focused.

**Consequences.** Discoverability via Help modal (ADR-017). No shortcuts
that conflict with browser defaults.

---

## ADR-016 — Undo / redo history

**Context.** Aggressive randomization or palette tweaking can lose a
beautiful in-progress design.

**Decision.** Stack of state snapshots (cap 30) on every meaningful change
(debounced 200ms). `Cmd/Ctrl+Z` pops, `Cmd/Ctrl+Shift+Z` pushes back.

**Consequences.** State is small (~1 KB) so 30 snapshots costs ~30 KB. Cap
keeps memory bounded.

---

## ADR-017 — Help / shortcuts modal

**Context.** Lots of features now exist; users will not discover them by
poking around.

**Decision.** A `?` key opens a centered modal listing every shortcut,
every layer toggle's effect, and a tip about URL hash sharing. Closes on
`Esc` or click outside.

**Consequences.** Pure DOM. Self-documenting — single source of truth for
"what can this app do".

---

## ADR-018 — City quick-fly presets

**Context.** First-time users land on Paris. They want to try their own
city but don't want to type into a search box on every visit.

**Decision.** Twelve quick-fly buttons (Paris, NYC, Tokyo, London, Berlin,
São Paulo, Mumbai, Sydney, Cairo, Mexico City, Istanbul, Lagos) — one
diverse-by-design lineup so the geography feels global, not Western.

**Consequences.** Each button stores `[lng, lat, zoom]` and triggers
`flyTo`. ~700 bytes total. Selection updates the title automatically.

---

## ADR-019 — Seedable randomize

**Context.** "I love this random palette but I lost it" is a common
complaint. Pure randomness is destructive.

**Decision.** A seed input next to the Randomize button. Empty seed = true
random; seed value = deterministic mulberry32 PRNG. The seed is encoded in
the URL hash, so a shared link reproduces the exact palette.

**Consequences.** Adds 6 lines of code (mulberry32 is tiny). Unlocks "I
randomized 47 times, this is the one I want, and now I can revisit it
forever" — which is the core magic loop.

---

## ADR-020 — Onboarding hint on first visit

**Context.** Without guidance, users miss the best features (Randomize,
GPX upload, the GitHub link).

**Decision.** On first visit (no `osm-poster:visited` flag in
localStorage), show a single dismissible tooltip near Randomize that says
"Try ⚂ Randomize, or press `?` for shortcuts". Set the flag on dismiss.

**Consequences.** One-time UI noise; never annoys returning users. Zero
network cost.

---

## Implementation order

1, 2, 18 — state/persistence/quick wins (foundation).
3, 4, 7, 14 — decorative overlays (visual upgrade).
5, 6, 8, 9, 10 — interactive content (the soul of the app).
11, 12, 13 — export polish.
15, 16, 17, 19, 20 — UX polish.

All shipped in a single index.html file. No build step.
