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

---

## ADR-021 — Pinhead icon library for markers

**Context.** The four built-in marker icons (pin / heart / star / dot) are
fine but generic. For "café where we met", "the lighthouse", "the chess
park", "the bridge over the Seine" — users want category-specific icons.
Bundling 1,000+ SVGs ourselves is wasteful and an open-ended maintenance
job; building a sprite-sheet pipeline is overkill for a single-file site.

**Decision.** Lazy-load icons from
[Pinhead](https://github.com/waysidemapping/pinhead) (CC0 / public domain,
1,000+ map-pin-optimized SVGs) via the jsDelivr CDN at request time. Ship a
**curated 36-icon picker** across six categories (Symbols, Travel, Activity,
Outdoor, Culture, Built) so users see something useful immediately, with a
search box to filter. Cache fetched SVGs in a `Map<string, string>` so the
same icon costs zero requests on subsequent uses.

**Consequences.** Zero kilobytes added to the bundle; a Pinhead icon costs
one ~1-2 KB fetch the first time and 0 thereafter. Marker `state.marker.type`
gets a new `pinhead:<name>` shape that survives URL-hash sharing and undo.
Icons render in the active palette's `accent` color via `fill: currentColor`
on the loaded SVG. Failed fetches degrade gracefully (cell dims to 35%
opacity; falls back to the default pin if applied to an active marker).

---

## ADR-022 — Image-to-palette eyedropper

**Context.** Users want their poster to match a vibe — a photo of their living
room, a band's album art, a sunset they took. Picking 9 hex codes by eye to
match an image is brutal.

**Decision.** Drop any image onto the sidebar. Sample its pixels in a hidden
canvas, run a small k-means (k = 9) on the RGB space to get a coherent
palette, then map clusters to our 9 palette slots by luminance and saturation
heuristics (darkest → bg or building, most saturated → accent, etc.). All
in-browser, never uploads.

**Consequences.** Magical "color theft" interaction in <2 seconds. The
mapping isn't always perfect — `Reset preset` undoes cleanly. Adds ~1.5 KB
of code.

---

## ADR-023 — Time-of-day atmospheric tint

**Context.** Maps look the same at every hour, but real cities don't. A
golden-hour Paris should feel different from a midnight Paris.

**Decision.** Five preset CSS-filter combinations: **Dawn** (cool blue,
desaturated), **Day** (no filter), **Golden hour** (warm sepia + slight
saturation), **Dusk** (deep magenta tint), **Night** (heavy darken +
contrast). Optional **Auto** mode reads the user's local clock and picks
based on solar time at the displayed coordinates.

**Consequences.** Pure CSS filter on `#map-wrap` — no extra fetches, exports
correctly via html-to-image. Auto mode adds a tiny SunCalc shim.

---

## ADR-024 — Map annotations

**Context.** A poster of "where we got married" is incomplete without a
small label and arrow at the actual chapel. Today the user has to add it in
post-production.

**Decision.** Click anywhere on the map → small inline editor appears for a
short text. Annotation persists at lat/lng with an optional curved-arrow
direction. Multiple annotations supported, all stored in URL hash. Renders
as DOM overlay so html-to-image picks them up.

**Consequences.** Adds a click handler on the map that doesn't conflict with
panning (long-press or modifier-click). Each annotation costs ~50 bytes in
the URL hash.

---

## ADR-025 — Auto-subtitle suggestions

**Context.** "The City of Light" is fine for Paris but doesn't translate. A
user mapping their hometown of 4,000 people in Iowa has nothing to write.

**Decision.** When a place is selected, fetch from Nominatim's reverse-geocoding
+ a small open-data lookup (elevation from OpenTopoData, country from
Nominatim, sunrise from a sun-position calc). Surface 4-5 click-to-use
subtitle suggestions: "Population 4,127" · "423 m above sea level" · "Where
the sun rises at 06:42" · "Iowa, USA".

**Consequences.** One extra Nominatim call per place selection (debounced,
within usage policy). Suggestions are dismissible — never auto-applied.

---

## ADR-026 — Print-bleed PDF export

**Context.** A user takes their A3 PDF to a print shop and gets back a
poster with white edges because the PDF has no bleed. Frustrating after
they paid €40.

**Decision.** Add a `Print bleed` toggle in PDF export. When on, the export
adds 3 mm of bled artwork on all sides, plus 4 corner crop marks at the
trim line. The map render is enlarged to cover the bleed area, the caption
is positioned within the safe area only.

**Consequences.** Existing PDF export grows by a fraction of a percent.
Crop marks are simple SVG lines at ~5 mm from the corner, drawn in
`#000000` over the bleed.

---

## ADR-027 — Custom font upload

**Context.** Brand-conscious users want to use their own typeface for the
caption. Limiting them to four Noto Sans weights is a creative cap.

**Decision.** A drop zone in the Typography sub-section accepts `.woff2`,
`.woff`, and `.ttf` files. The font is registered with `FontFace` API,
applied via a CSS class on the caption, and persisted in localStorage as
base64 (capped at 1 MB). Fonts only affect the caption — map labels stay
on Noto (they need OpenFreeMap-served glyphs).

**Consequences.** A 200 KB woff2 = ~270 KB base64 in localStorage. Cap
prevents quota issues. The font loads instantly on next visit.

---

## ADR-028 — Photo polaroid overlay

**Context.** Real-life moments happen at real places. A poster of "where we
got engaged" is good; a poster with the actual selfie pinned to the map at
that point is unforgettable.

**Decision.** Drop a photo onto the map. It renders as a small, slightly-
tilted Polaroid (white frame, soft shadow) at the click location, anchored
to that lat/lng so panning keeps it in place. Optional handwritten caption
underneath. Image stored locally (base64) and exported via html-to-image.

**Consequences.** Image stays on the device. Multiple polaroids supported.
Each ~30-100 KB in localStorage; URL-share strips them but localStorage
persists across sessions.

---

## ADR-029 — Edition serial number

**Context.** Every "framed map" sold in shops has a tiny "Edition 047/100"
that makes it feel collectible. Our exports are infinite digital copies —
but we can fake the artifact.

**Decision.** Each export receives a deterministic short ID derived from
(state hash + timestamp + monotonic counter from localStorage). Example:
`№ A47B · ∞`. Printed micro-small (7 px) in the bottom corner of the
caption, alongside the existing URL watermark.

**Consequences.** Pure cosmetic. Counter persists across sessions so each
user has their own "edition" sequence. Adds 0 network calls.

---

## ADR-030 — POI cluster chips

**Context.** Zoom out from a dense city and 25 individual icons crowd the
view, especially on Story / A4 sizes. The user can't read what they
selected.

**Decision.** When zoom < 13, group POIs within a screen-pixel radius into
a single chip showing the dominant category icon plus a count badge
(e.g., 🍽 12). Click expands the cluster (when not exporting).

**Consequences.** Algorithm: bin features into ~32-px screen cells, render
one marker per cell. Label is the count. Reuses the existing
`maplibregl.Marker` machinery — no MapLibre source-clustering needed, so
it works with our HTML markers.

---

## ADR-031 — City-shape outline highlight

**Context.** A Paris map should *feel* Paris-shaped. Right now the city's
admin boundary is rendered as a thin dashed line that no one notices.

**Decision.** Optional toggle: render the displayed place's administrative
polygon as a glowing accent-colored outline that subtly follows the city
limit. Fetched from Nominatim's `polygon_geojson=1` parameter on place
selection, cached in localStorage.

**Consequences.** One extra Nominatim parameter, response payload grows
by 5-50 KB depending on the polygon detail. Cached after first fetch per
place.

---

## Templates 9-12

Four new full templates added alongside the existing eight. Each carries
the standard `TEMPLATE_FIELDS` so a click reshapes the whole poster:

- **Watercolor** — soft pastel wash on cream paper, italic labels,
  thin border + paper grain + compass on. No buildings; paths visible.
- **Espresso** — dark coffee brown background with cream lines and
  amber roads. Square frame, double border, paper grain.
- **Constructivist** — Soviet-poster vibe: cream + black + bold red.
  Buildings as solid black, no nature, weight 1.8×, bold border.
- **Aurora** — deep navy with sky-green roads and teal accent, evoking
  northern lights. Compass on.

---

## ADR-032 — Road casing

**Context.** On dense maps, road lines blend into the surrounding fill
(buildings, parks). Cartographers use a "casing": a slightly wider
under-line in the background color so each road reads as embossed.

**Decision.** When the **Road casing** toggle is on, every road class
gets a casing layer (≈1.8× the visible width, painted in `palette.bg`)
pushed before the colored line. Costs one extra layer per class — six
layers total — but reuses the same source-layer query.

**Consequences.** Adds visual depth at zero data cost. Disables cleanly
when the toggle is off (no layers added).

---

## ADR-033 — Road glow

**Context.** Cyberpunk / neon styles look anemic when roads are crisp
hairlines. A blur halo around the line gives them luminous weight.

**Decision.** When the **Road glow** toggle is on, every road layer
gets `paint['line-blur'] = 2.5`. Pure paint property — no extra layers,
no layout disruption.

**Consequences.** Subtle glow that compounds with bold accent road
colors (Cyberpunk, Tron). Doesn't affect line weight or hit-testing.

---

## ADR-034 — Map saturation slider

**Context.** Sometimes a palette is *almost* right — the user wants
the same colors but more vibrant or more muted. Editing 9 swatches by
hand to nudge saturation is brutal.

**Decision.** A saturation slider 0-200% applies `filter: saturate(X)`
to `#map-wrap`. Composes correctly with the time-of-day tint by
unifying both into the inline filter string when either is non-default.

**Consequences.** One CSS property, instant feedback. 100% = no change.
Combines with contrast slider in the same filter chain.

---

## ADR-035 — Map contrast slider

**Context.** Pastel palettes can look washed-out at small print sizes;
dark themes can lose detail. A contrast knob lets the user push or
pull the dynamic range.

**Decision.** Slider 50-150% → `filter: contrast(X)` on `#map-wrap`,
chained with saturation and TOD filters into one inline filter.

**Consequences.** Below 50% the map turns soggy; above 150% it
crushes blacks. Range chosen to stay tasteful by default.

---

## ADR-036 — Vignette overlay

**Context.** Every "framed travel poster" in a hotel hallway has a
subtle radial darken at the edges. It pulls the eye to the center
without anything explicit.

**Decision.** Four vignette presets: **none / soft / heavy /
spotlight**. Implemented as a `radial-gradient` on a positioned
overlay div inside `#map-wrap`. Does not interact with the CSS filter
chain; renders as a separate compositing layer.

**Consequences.** Captured by `html-to-image`, exports correctly.
Spotlight is intense — useful for poster-of-a-single-place mode.

---

## ADR-037 — Title ornament

**Context.** Plain `PARIS` is fine. `✦ PARIS ✦` is a poster.

**Decision.** A select with five values: **none, bullets (●  T  ●),
dashes (—  T  —), brackets ([  T  ]), asterisks (✦  T  ✦)**. Wrapping
happens in `decorateTitle()` and runs from both the title-input
listener and `applyTitleOrnament()` so live edits stay decorated.

**Consequences.** Pure text, exports cleanly. Anniversary mode bypasses
ornaments because it has its own "A & B" composition.

---

## ADR-038 — Caption divider style

**Context.** The single 1-px line between the map and the caption is
clean but invisible. Vintage posters often use double rules, dotted
rules, or wavy ornaments.

**Decision.** Five values: **line (default), none, dotted, double,
wave**. Wave uses an inline SVG repeating along `background-image`
and bumps `padding-top` to clear it.

**Consequences.** All CSS, no extra DOM. The wavy variant is busy on
small frames; works best on portrait/A4.

---

## ADR-039 — Sprinkle stars overlay

**Context.** Night-themed maps (Midnight, Cyberpunk, Aurora) feel flat
without atmospheric noise. Real night skies have stars.

**Decision.** Decorative overlay div pre-baked with 9 fixed-position
`radial-gradient` stars at varying sizes and opacities. Toggle on/off.
Shows above the map and texture overlays so it lifts off whatever's
beneath.

**Consequences.** Pure CSS, zero JS work per frame. Positions are
fixed (not random per session) so toggling doesn't reflow.

---

## ADR-040 — Title spacing fine-adjust

**Context.** The four `Title size` presets (small / medium / large /
xl) each lock a fixed letter-spacing. Sometimes a user wants the
medium size with looser tracking, or the large size with tighter.

**Decision.** A single slider −4 px to +12 px applied via inline
`letter-spacing` calc on `#caption-title`, layered over whatever the
size preset chose.

**Consequences.** Subtle, professional knob. Default 0 px = no change.

---

## ADR-041 — Building shape (filled / outlined / wireframe)

**Context.** On dark themes, solid-filled buildings hide ground-level
detail. On minimalist designs, building outlines are more elegant
than fills.

**Decision.** Three values for the **building shape** dial:
- **Filled** — current opacity-ramped fill (default)
- **Outlined** — fill at 4-22 % opacity with a stronger label-color outline
- **Wireframe** — `fill-opacity: 0` plus accent-colored outline only

Applies to flat (2D) buildings only; 3D extruded buildings stay solid
because outlines on extrusions don't render meaningfully.

**Consequences.** All three modes share the same source/feature query;
just `paint` properties change. No extra layers.

---

## ADR-042 — Global hue rotation

**Context.** Saturation and contrast tweak intensity but can't shift
the overall mood. A single hue knob unlocks "what if Paris were
purple?" without rebuilding the palette.

**Decision.** Slider 0-360°. Composes into the same `filter` chain as
saturation, contrast, and TOD by extending `applyMapFilters`. 0° = no
change.

**Consequences.** Costs zero render frames — purely a CSS filter.
Plays well with hand-picked palettes; large rotations lose preset
intent, which is fine because that's the point.

---

## ADR-043 — Map mask shapes

**Context.** A square / portrait poster of "where we got engaged" is
fine. The same map cropped to a heart is unforgettable for the right
occasion.

**Decision.** A select with five shapes plus none: **circle, rounded
corners, hexagon, star, heart**. Each maps to a CSS `clip-path` on
`#map-wrap`. The caption stays rectangular below — only the map area
is shaped.

**Consequences.** clip-path works in every modern browser. The shape
clips ALL overlays (vignette, grain, compass), which is the correct
behavior. Exports correctly via html-to-image.

---

## ADR-044 — Sketch frame overlay

**Context.** The four border styles (none / thin / double / bold) are
all geometric. Travel-journal posters want a hand-drawn feel.

**Decision.** A **Sketch frame** toggle adds an SVG overlay containing
two intentionally-jiggly Bezier rectangles — one solid, one dashed at
60% opacity — that follow the poster bounds. Stroke color is bound to
the existing `--border-color` CSS variable so it tracks themes.

**Consequences.** Pure SVG with `vector-effect: non-scaling-stroke`,
so the line weight stays consistent at any export resolution. Layers
above the map but below the caption (z-index: 6).

---

## ADR-045 — Custom watermark text

**Context.** The default URL watermark is fine for sharing the
project, but personal posters want a quote, a date, a name, or
nothing branded at all.

**Decision.** A text input under the caption fields. When non-empty,
its value replaces the default URL string in `.caption-mark`. Empty =
default URL falls back. Lives in `state.watermark` and persists via
the standard URL hash + localStorage path.

**Consequences.** One element, three lines of code. Capped at 60 chars
to keep typography clean.

---

## ADR-046 — Confetti micro-celebration

**Context.** Pressing **Randomize** returning a beautiful palette
should *feel* like a small win. Same for **Export** — the moment of
"the poster is done."

**Decision.** A 36-particle CSS-animated burst from the center of the
poster area on Randomize / Randomize-style / Export. Particles are
positioned with `--dx` / `--dy` custom properties, rotated, and faded
over 1.5s via a single keyframe.

**Consequences.** Pure CSS animation, runs on the GPU, doesn't block
the export pipeline. Disabled inside the export render itself
(timeout fires after html-to-image finishes its capture, so the
exported file never has confetti baked in).

---

## ADR-047 — Custom PNG/SVG mask

**Context.** The five clip-path mask shapes (circle / rounded /
hexagon / star / heart) cover the geometric cases. Real personalization
needs organic shapes — a torn-paper edge, a coffee mug silhouette, a
constellation outline.

**Decision.** A new `Custom` option in the Map mask select that uses
CSS `mask-image` (instead of `clip-path`) on `#map-wrap`. Drop a PNG,
SVG, or WebP — alpha channel becomes the visible area. Image data is
read as a data URL and cached separately in localStorage under
`osm-poster:mask` (data URLs would be too large for the URL hash).
Ships with a built-in **Use sample (torn paper)** button that uses
an inline SVG silhouette, so the feature is discoverable in two
seconds.

**Consequences.** mask-image uses the alpha channel, so any PNG with
transparency works (a black-and-white PNG also works — the dark areas
become visible). Full vendor-prefix support for older WebKit. Mask
state survives undo/redo and reload, but not URL-hash sharing — a
shared link drops back to the chosen named shape.

---

## UI consolidation pass (no ADR — UX work)

Merged related sub-disclosures to reduce sidebar surface area:

- **Place → Search** absorbed Quick cities (chips now sit below the
  results dropdown). One disclosure instead of two.
- **Place → Map view** absorbed the Roads quick-preset (Off / Simple /
  Detailed) — the buttons live above the rotation/tilt/weight/heights
  sliders, separated by a "Road preset" sub-title. One disclosure
  instead of two.
- **Compose → Caption** absorbed Typography. All caption-related
  controls (text, typography selects, custom font upload) now live in
  one section, organized by inline sub-titles. One disclosure instead
  of two.

Net: 3 fewer disclosures with no functionality lost.

---

## ADR-048..053 — 6 more Style-option dials, sub-grouped

**Context.** Style options had only 4 selects (roads / font / border /
texture), and they sat in a flat grid with no hierarchy. Two issues:
nothing told the user what kind of thing each select governed, and the
panel was small enough that "more dials" was a clear ask. Plus 3D
posters wanted a separate roof color so buildings could be two-toned.

**Decision.** Added `roof` as a 10th palette swatch (defaults to walls
when missing) and added six new dials in Style options:

- **ADR-048 Roof tone** — match / lighter / darker / accent / Use
  Roofs swatch. Drives the 3D extrusion fill color.
- **ADR-049 Building shading** — toggle on `fill-extrusion-vertical-gradient`
  for both 3D layers.
- **ADR-050 Label case** — as-is / uppercase / lowercase, applied via
  text-transform on every place / country / neighborhood symbol layer.
  When 'as-is' is selected each layer keeps its native casing.
- **ADR-051 Card shadow** — none / soft / hard / float. CSS box-shadow
  on `.poster-wrap`, transitions when the user switches.
- **ADR-052 Park opacity** — subtle (0.35) / normal (0.75) / bold
  (0.95). Drives the parks fill alpha so user can dial parks in or out
  without toggling the layer.
- **ADR-053 Road caps** — round / butt / square. Maps to MapLibre's
  line-cap layout property. Dashed roads stay butt regardless to keep
  dash spacing crisp.

The Style options panel itself was reorganized into 5 sub-groups
(🛣 Roads · 🏢 Buildings · 🅰 Labels · 🌳 Parks · 🖼 Frame) with inline
sub-titles and selects laid out 2 per row.

`palette.roof` migrates in from `building` for any preset / saved
state that doesn't define it (clonePreset + mergeState).

**Consequences.** No dial leaks into another section. Randomize style
now covers 13 dials at once. Existing presets render identically
because `roof = building` by default and shading is on by default.

---

## ADR-054 — Realistic sun lighting (production library)

**Context.** The `Time of day` tint was a CSS filter approximation —
the whole map turned warm or cool, but 3D buildings didn't get
directional shading from a believable sun position. Users wanted
real "lit by the sun" 3D buildings.

**Decision.** Two production-ready pieces, no custom math:
- **[SunCalc 1.9](https://github.com/mourner/suncalc)** (~3 KB, MIT) loaded from
  unpkg — battle-tested sun-position calculator used by the BBC,
  Strava, etc. `SunCalc.getPosition(date, lat, lng)` returns
  `{ azimuth, altitude }` in radians.
- **MapLibre's built-in `map.setLight()`** API. It already exists in
  4.x and feeds `fill-extrusion-color` shading on every 3D extrusion
  layer. We just feed it the right values.

`applySunLight()` converts SunCalc's south-anchored azimuth to
MapLibre's north-anchored degrees, maps altitude to polar angle, and
picks a color via a luminance ramp (sunrise/sunset = warm orange,
golden = warm cream, noon = white, dusk/dawn = cool blue, night =
deep navy at low intensity 0.18).

Triggered by the `Sun light` toggle in Decorations, recomputed on
map move (debounced 80 ms) and on view restore.

**Consequences.** Real cast shadows aren't supported in MapLibre 4
yet (5.x has experimental shadows). Combined with
`fill-extrusion-vertical-gradient: true`, the directional light
gives a convincing "lit from the south at 4pm" feel without the cost
of a separate shadow renderer. Bundle adds 3 KB.

---

## ADR-055 — Sun direction arrow

**Context.** When realistic lighting is on, users want to see *where*
the sun is coming from. A small visual indicator answers that.

**Decision.** A 44-px SVG sun (disc + 8 rays) in the top-left of
the map area. The whole group rotates to match the SunCalc azimuth
at the displayed coordinates. A tiny `HH:MM` label sits below,
rotated back so it stays upright. Color tracks `palette.label`.

**Consequences.** Always shows the user's local time at the displayed
location's longitude — which is what feels right for a poster.

---

## ADR-056 — Zoom level indicator

**Context.** Designers exporting at A2 / A3 want to know exactly
what zoom the export was at, so the next print is consistent.

**Decision.** Tiny `z 12.4` chip pinned to top-center of the map
area. Pill-shaped, semi-transparent backdrop-blur background,
monospace 9.5 px. Updates on map move.

**Consequences.** Hidden by default. Captured in exports if left on
— users can use it for archive metadata, then turn it off.

---

## ADR-057 — Vintage corner ornaments

**Context.** "Sketch frame" gives wobbly hand-drawn vibes. For
classic Travel-Guide / Espresso / Botanical templates, vintage map
corner flourishes are a different aesthetic.

**Decision.** Four 38-px SVG ornaments, one per corner. Each is a
simple curl-and-dot motif with `vector-effect: non-scaling-stroke`
so the line weight stays uniform at any export resolution. Colors
inherit from `--border-color` so they track theme changes.

**Consequences.** Pure SVG, lightweight. Toggleable as one button —
all four corners go on/off together; that's intentional, mixed
corners look chaotic.

---

## Decorations cuter pass (UX)

The Decorations sub-section was 5 checkboxes plus 2 small selects.
Reorganized to match the visual language of the Layers grid:

- 9 icon-button toggles in the same `.layer-grid` component
  (🧭 Compass · 📏 Scale · 📅 Date · ⊞ Grid · 🏙 Outline ·
   ☀ Sun light · ↗ Sun arrow · 🔍 Zoom · ❉ Ornaments)
- Active state = accent fill + accent border + accent text
- Selects below pick up emoji prefixes per option for quicker scanning
- One unified click dispatcher (`DECO_HANDLERS`) instead of 5
  separate event handlers — half the code, easier to extend

---

## ADR-058 — Sidebar information architecture: 4 × 3-4 panels

**Context.** The sidebar had grown into 3 top-level categories with
sub-section counts of 2 / 10 / 6. The Style category alone shipped
ten panels (Templates, Palettes, Layers, Map icons, Custom colors,
Map style, Frame, Effects, Filter stack, Decorations). Users
reported "too many things split across too many places, hard to
find anything"; the Effects panel in particular was a junk drawer
holding road effects, color filters, title typography, and mask
shapes all in one body.

**Decision.** Four top-level categories, each with 3-4 sub-panels
grouped by *user intent* rather than by which subsystem owns the
state. Mapping from old → new:

| New panel | Pulled from |
|---|---|
| 📍 **Place** → Search · View · GPX route | Place + GPX moved out of Compose |
| 🎨 **Style** → Templates · Palette · Layers · Map style | merged Palettes + Custom colors; folded road effects (casing, glow) into Map style |
| ✨ **Effects** → Filter stack · Map filters · Decorations & mask · Map icons | split the old Effects junk drawer; kept Filter stack as its own panel because it grows unbounded |
| 📐 **Compose** → Caption · Frame · Pins · Commemorative | merged Annotations + Polaroids → Pins; folded Aspect ratio into Frame; moved title ornament / caption divider / spacing into Caption (typography belongs with the rest of caption typography) |

Two panels became unified: *Palettes + Custom colors* → **Palette**
and *Annotations + Polaroids* → **Pins**. Three panels were
relocated to the category whose mental model fit them: *GPX route*
to Place, *Aspect ratio* to Frame, *title ornament/divider/spacing*
to Caption.

**Consequences.** Sub-panel count dropped from 18 to 15, but the
real win is the cap of 4 per top-level — the eye can reliably scan
4 in one pass. Existing IDs and JS handlers were preserved, so the
only code touched was the HTML scaffolding plus a few `<select>`
removals (see ADR-059).

---

## ADR-059 — Native `<select>` retirement for short option lists

**Context.** Short dropdowns (titleWeight, titleSize, subtitleStyle,
coordsStyle, labelFont, compassStyle, plus a few already-migrated
ones like roadStyle and buildingShape) felt out of place next to
the chip-groups everywhere else. A native `<select>` requires two
clicks to change a value (open menu → pick) versus one tap on a
chip; it also fights the visual rhythm of the modernised sidebar.

**Decision.** Any option list of ~6 items or fewer migrates from
`<select><option>...</option></select>` to a `.chip-group` with
`data-chip-key` + `data-options='[[value, label], ...]'`. The
`initChipGroups()` machinery in `js/dials.js` already handles
state-write + history + persist + per-key post-apply hook (via
`CHIP_AFTER`); the migrations just register their post-apply
function (e.g. `titleSize → applyTypography`) and a default value
in `_chipDefaults`. The corresponding `<select>` change listeners
in `js/ui.js` and `setSelect(...)` calls in `js/apply.js` were
deleted — the chip-group machinery covers both directions.

Selects intentionally **kept** native:

- `mapMask` (7 options including a "Custom upload" path)
- `todTint` (7 options with long descriptive labels)
- `exportFormat` / `exportSize` (deliberately understated, separate
  from the styling controls)

Their visual chrome got a custom chevron and a softer surface so
they read as part of the same design system without us having to
build a custom dropdown component.

**Consequences.** One tap to change weight/size/font, no native
dropdown chrome blinking onto the page, and one less code path
keeping the UI in sync with state (chip-groups self-sync via
`syncChipGroups()` from any `applyState()`). Adding a new chip-group
elsewhere is now: *write the HTML* — that's it.

---

## ADR-060 — Mobile-first sidebar: 44px tap targets, no iOS zoom

**Context.** The existing `@media (max-width: 800px)` rules
collapsed the sidebar to a stacked top section, but tap targets
varied (some buttons were 38px tall, sliders had no min-height),
text inputs were ~14px which triggers iOS Safari's auto-zoom on
focus, and the disclose buttons used the same metrics as desktop
which made hierarchy hard to scan on a phone.

**Decision.** Single mobile breakpoint at 800px hardens the
responsive pass:

- Every interactive control gets `min-height: 44px` (Apple HIG)
  including sliders' parent rows, toggles, frame chips, marker
  buttons, the export button, and selects
- Disclose buttons are sized differently per nesting level
  (major: 64px / sub: 52px) so the IA hierarchy stays visible
  even when text gets larger
- All text inputs use `font-size: 16px` — iOS Safari only
  auto-zooms on focus when the input is **smaller** than 16px
- Selects keep their custom chevron at 36px right padding so
  the value text doesn't visually collide with the icon
- Cities pills bump from 26px to 36px height to be tappable
  without precision

Plus the always-on rules: chip-groups, layer-buttons, palette
swatches, and template cards already have 44px+ tap targets so no
mobile-specific override is needed for them.

**Consequences.** The same HTML works for desktop and mobile;
the 800px breakpoint is the only customization point. Any new
controls following the existing visual language (chip / layer-btn /
toggle / select with `aside select`) automatically pick up the
mobile metrics.

---

# Inspiration: MapToPoster (Python CLI tool)

A Python CLI by @originalankur that produces print-ready minimalist
maps (3630×4830 @ 300 DPI) from OpenStreetMap. It's the spiritual
sibling of this project but lives on the command line. Reading
through their workflow — `--distance` in metres, themes as files in
a `/themes/` folder, `--dpi` for fast vs print-quality renders —
surfaced 20 improvements we can pull into the web-native tool. The
ADRs below capture them as future work, ranked roughly by impact.

---

## ADR-061 — Distance-based framing dial (km/mi)

**Context.** Users describe what they want to map in real-world units
("show me ~5 km around the centre"), not logarithmic zoom levels.
MapToPoster's `--distance` flag is intuitive — 4 km for dense city,
20 km for metropolitan area, 2 km for a small town.

**Decision.** Add a "Frame distance" slider in **Place → View** that
shows the visible diameter in km (or mi by locale). It computes the
target zoom from `Math.log2(40075 / distance_km / cos(lat))`. The
existing zoom slider stays as the power-user control. State key
`state.frameDistance` (number, km).

**Consequences.** A second-screen way to set zoom that matches how
people think about maps. Doesn't replace anything — additive UI.

---

## ADR-062 — Export profile bookmarks

**Context.** Templates set the *visual* recipe; the user often also
wants to save the export-time recipe (size + format + bleed + DPI +
crop guides) as a separate concern. Recreating "my A2 print
settings" each time is friction.

**Decision.** New "Profiles" sub-panel in Compose. Each profile is a
named snapshot of the export-related state (size, format, bleed, DPI
bump, mask, frame, watermark). Save / load via dropdown. Stored in
localStorage under `osm-poster:profiles`. State key
`state.exportProfile` (string).

**Consequences.** Templates remain about looks; profiles are about
deliverables. Cleanly separated mental models.

---

## ADR-063 — Custom DPI selector (real numbers)

**Context.** Today's "size" picker (screen 4× / A2 / A3 / A4 / 4k) is a
multiplier abstraction. Print shops talk in DPI. MapToPoster has
explicit `--dpi 150` for previews and 300 for print.

**Decision.** Add a DPI segment to the Export panel: 72 (web), 150
(preview), 300 (print), 600 (fine-art print). Compute the
`html-to-image` `pixelRatio` from `dpi / 96`. The size picker stays
as the trim-area selector; DPI determines pixel density.

**Consequences.** Users pick "A2 @ 300 DPI" instead of "A2 print"
and know exactly what file they'll get. Pricing-conversation parity
with print shops.

---

## ADR-064 — JSON theme import / export

**Context.** MapToPoster's `/themes/` folder lets users share themes
as files. Our templates live in JS source — not user-shareable.

**Decision.** Two buttons in the Templates panel: **Export current as
JSON** (download `<state>.osmposter.json` containing palette + layers
+ all dial state) and **Import** (file picker that hydrates state).
Schema version-stamped (`v: 1`) so future format changes can migrate.

**Consequences.** Themes become first-class shareable artefacts. A
Discord/community gallery of themes becomes possible. Existing URL
hash sharing is great for one-shot share; JSON file is great for
collections + Git.

---

## ADR-065 — Direct coordinate input

**Context.** Power users sometimes want to jump to exact coordinates
(a hike's start point, a birthplace) without typing a place name and
hoping Nominatim returns the right result.

**Decision.** Search field accepts coordinate strings — "48.8566,
2.3522", "48° 51' 24" N 2° 21' 8" E", or geohash. Detected via regex
before falling through to Nominatim. Existing search UI is
unchanged; the parser is just smarter.

**Consequences.** Power-user shortcut, zero new UI. Reduces
geocoding round-trips.

---

## ADR-066 — Map scale lock

**Context.** Easy to accidentally scroll-zoom while panning to fine-
tune the centre. Locking the zoom decouples those two intents.

**Decision.** Toggle in Place → View: "🔒 Lock scale". When on,
`map.scrollZoom.disable()` / wheel-zoom is intercepted; pan still
works freely. Visual indicator in the corner of the map.

**Consequences.** Tight composition workflow without trial-and-error
zoom drift. Off by default.

---

## ADR-067 — Side-by-side template comparison

**Context.** With 28 templates it's hard to choose without trying
each. A comparison view lets the user pick 2–4, render the same
location in each, and decide.

**Decision.** "Compare" button on the Templates panel opens an
overlay with up to 4 thumbnails of the current map under different
templates, rendered via small map instances at low pixelRatio for
speed. Click a thumbnail to apply.

**Consequences.** Decision quality up; clicks-to-pick down. Cost: 4
extra map instances during the compare overlay (cheap because
sub-resolution and ephemeral).

---

## ADR-068 — Favourite locations bookmarks

**Context.** Users often work on a series of posters for the same
city or for places they care about. Each time they have to search +
zoom + frame.

**Decision.** Star icon next to the search box adds the current
view (centre + zoom + bearing + pitch) to a Favourites list shown
underneath. Each entry has a thumbnail (rendered once via
`html-to-image` and cached as data URL) + a delete button. Stored
in localStorage at `osm-poster:favs`.

**Consequences.** First-class "places I care about" UX. Thumbnail
generation is a one-time cost per save.

---

## ADR-069 — Auto TOD from real solar elevation

**Context.** Current `tod: 'auto'` brackets by hour-of-day. SunCalc
is already loaded for 3D building lighting — we can use the actual
solar altitude to pick TOD instead of clock time.

**Decision.** When `state.tod === 'auto'`, look up SunCalc's altitude
at the current map centre + local time. Map altitude bands to TOD:
< -6° = night, -6° to 0° = dusk/dawn (golden), 0° to 30° = morning
or evening (sepia), > 30° = day. Replaces the hour-bracket logic.

**Consequences.** Tropical city at noon = bright daylight; the same
city at 6 PM = golden hour automatically. More physically correct.

---

## ADR-070 — Per-category POI density slider

**Context.** Today one global density slider caps total POIs. Users
often want "lots of restaurants, only a couple of museums" — the
global cap is too coarse.

**Decision.** Each `ICON_CATEGORY` gets its own density 0..max in the
Map icons panel, hidden behind a per-row "⋯" expand. Defaults match
today's global. State shape: `state.icons.categories = { food: { on,
density } }`.

**Consequences.** Fine-grained POI density. Mild migration: existing
saved states get backfilled to the global density.

---

## ADR-071 — Tile prefetch warming before export

**Context.** Export at high pixelRatio sometimes captures a partially-
loaded map if the user hits Export quickly after navigating. Tiles
for the export resolution may not be cached.

**Decision.** When the Export panel opens, start a background "warm"
pass that calls `map.setPixelRatio(targetRatio)` briefly to trigger
tile fetches for that resolution, then restores. Show a "warming
print cache…" indicator. By the time user clicks Download, the
tiles are in cache.

**Consequences.** Faster, more reliable exports. Costs a few seconds
of background tile fetches + GPU cycles. Easy to disable behind a
preference.

---

## ADR-072 — "Ultra minimal" template

**Context.** The aesthetic in the MapToPoster article is bare lines
on a clean background — no labels, no overlays, no decorations. We
don't have a template that goes that far.

**Decision.** New `minimal` template: solid bg, water + roads only,
no buildings/labels/parks/decorations, hairline road weight, no
border/texture/shadow. Pairs with a `Strip everything` quick action
that turns off all overlays in one click.

**Consequences.** A built-in answer for "I want THE minimalist look".
Easy starting point for users.

---

## ADR-073 — Print-margin / trim guides in preview

**Context.** With bleed enabled, users can't see in the preview
where the trim line will fall. They cut blind based on the export.

**Decision.** Toggle in Compose → Frame: "Show trim guides". Renders
a dashed frame inside `#poster` at the trim line (3 mm in from edge
when bleed is on). Hidden in the export but visible during editing.
CSS-only — no canvas changes.

**Consequences.** Compose for the trim, not the bleed. WYSIWYG-ish
for print.

---

## ADR-074 — Session palette history

**Context.** Users iterate on colors. After picking 8 colors over an
hour they sometimes want to go back to one they tried 20 minutes
ago. Browser's color picker doesn't remember.

**Decision.** Sidebar palette panel grows a thin "Recent" strip
showing the last 10 colors used (across any swatch). Click a chip
to apply to the most-recently-edited swatch. Store in
sessionStorage so refresh keeps history; clears on tab close.

**Consequences.** Lightweight color memory. No state schema change.

---

## ADR-075 — Headless URL-batch export

**Context.** Users making poster series (a city's neighbourhoods, a
trip's stops) currently re-edit per location. URLs already encode
full state; what's missing is the "render N URLs at once" step.

**Decision.** A "Batch" panel under Compose: textarea accepts one
URL per line (or filenames + URLs for naming). Click "Render all"
→ for each URL, hydrate state, render at the current export
settings, push to a ZIP. Download as `posters.zip`. Uses JSZip from
CDN (already small enough).

**Consequences.** Series-of-posters workflow without leaving the
browser. Batch is bounded by browser memory; works fine for ~25
posters at A3.

---

## ADR-076 — Smart label fields (city + region/country)

**Context.** Title is one freeform string today. MapToPoster
decouples city + country which lets it apply different sizing
rules per field.

**Decision.** Replace single title input with two: **Title** (large)
and **Subtitle** (medium). Today's `subtitle` becomes a third
optional **Tagline** (small italic). Existing single `title` migrates
to the new Title and the existing subtitle to Subtitle.

**Consequences.** Caption editing becomes more structured; templates
can theme each field's typography independently.

---

## ADR-077 — Visible distance scale next to the map

**Context.** The Scale Bar overlay shows distance, but it's
decorative on the map area. A more prominent "Showing 4.2 km × 6.3
km" readout helps composition.

**Decision.** A small text readout above the map (or inside the
Place → View panel) showing the current visible width × height in
the locale's preferred unit. Updates live with pan/zoom. No state
key needed — pure derived data from `map.getBounds()`.

**Consequences.** Composition feedback without staring at a slider.

---

## ADR-078 — Auto-suggest framing distance per city

**Context.** Picking a good distance for a city is a learned skill
(Tokyo at 4 km vs Tokyo at 30 km are very different posters). The
article hints at this: "decent maps of tiny towns by setting the
--distance flag to 2000 or lower".

**Decision.** When the user selects a place from search, peek at the
result's `boundingbox` from Nominatim and set the initial frame to
`min(20 km, max(2 km, area_diameter * 0.6))`. User can still
override; this is just the default landing.

**Consequences.** First-impression posters for new cities are
properly framed. Power users untouched.

---

## ADR-079 — Background pattern library

**Context.** Beyond grain and halftone, posters often use subtle
backgrounds — concentric rings (atlas vibe), pinstripes (newspaper),
dot grids (engineering paper), isobars (weather map).

**Decision.** New chip-group in Compose → Frame → Background:
`None / Grain / Halftone / Rings / Stripes / Grid / Isobars`. Each
is a CSS background-image (gradients or base64 SVG). Stacks with
the texture overlay if both are on.

**Consequences.** Visual variety without map data. Pure CSS, free
to ship.

---

## ADR-080 — One-click "good defaults" starter

**Context.** First-time users land on Blueprint over Paris zoomed in
on a random spot. New users need a 5-second-to-impressive flow.

**Decision.** A prominent "✨ Try a beautiful start" button on first
visit that picks: a tasteful template (rotates through Editorial /
Watercolor / Travel Guide), a famous city (Paris / Tokyo / NYC),
sensible distance (~6 km), bearing 0, pitch 0, all overlays off.
Dismissed forever after first click. Stored in localStorage.

**Consequences.** "Wow" moment on first visit without a tutorial.
Returning users don't see it.

---

---

# Output cleanliness: making the rendered poster look more like a designer made it

A second pass after ADR-061..080. The first round was inspired by what
MapToPoster lets the user *do*; this round is inspired by what their
output *looks like*. Comparing a typical MapToPoster export to ours:
they default to less (no labels, single-tone water, deliberate road
hierarchy, no 3D buildings, generous margins, calm caption). Ours
defaults to more (every layer toggleable, every label class on, busy
defaults). The 20 ADRs below close that gap by making "designer-clean"
either the default or one click away.

---

## ADR-081 — Anti-clutter dial (single 0..100 slider)

**Context.** A user who wants a clean poster currently has to disable
~12 layers + tweak ~6 dials by hand. There's no fast path from "show
me everything" to "show me almost nothing".

**Decision.** Single slider in **Style → Map style** labelled "Density"
that progressively strips detail as it goes left:
- 100: today's full-detail render
- 80:  hide POI markers, hide street labels
- 60:  hide neighborhoods, hide industrial, parking, military
- 40:  hide buildings, hide cycleways, hide paths
- 20:  hide rivers (keep main water), thin roads to motorway+primary
- 0:   only the bg color + water polygon + motorway lines

State key `state.density` (number 0..100). Doesn't replace the per-
layer toggles; it overrides them at render time and the toggles snap
back to today's values when density is 100.

**Consequences.** One slider gets the user to MapToPoster-clean in
seconds. Existing template values are kept; the dial layers on top.

---

## ADR-082 — Road hierarchy weight ramp

**Context.** Today every road class draws with a fixed width-multiple
(`base * roadWeight`). At small print sizes this means a minor lane
and a motorway are nearly indistinguishable, which reads as cluttered
because every road is shouting equally loud.

**Decision.** Replace flat multiples with an exponential ramp keyed off
zoom and class: motorway 4× the visual weight of minor, with the
ratio holding across zooms. New chip-group `roadHierarchy` with
options `flat / soft (1:1.5) / firm (1:3 — current default behaviour)
/ strong (1:4) / extreme (1:8)`. Strong is the MapToPoster default
look — clear arterials against a hairline grid of lanes.

**Consequences.** Posters look intentional rather than uniform.
Motorways read as "the spine of the city", minor roads as texture.

---

## ADR-083 — Zoom-driven layer LOD

**Context.** Some layers are too dense to be useful at certain zooms
(every street label at z 11 is illegible; every POI at z 18 is
overlap soup). MapLibre supports `minzoom`/`maxzoom` per layer; we
use it sporadically.

**Decision.** Audit every layer in `style.js` and add deliberate
`minzoom`/`maxzoom` so each one only paints in the range where it's
readable. Codify as a small constant `LOD_RANGES` keyed by layer id
so the rules are visible in one place rather than scattered.

**Consequences.** Posters at low zoom auto-strip, posters at high
zoom auto-add detail without user intervention. No new dial.

---

## ADR-084 — Label collision avoidance

**Context.** With cities + neighborhoods + streets + water names +
park names all on, labels stack on top of each other and become
unreadable mush. MapLibre supports `text-allow-overlap: false` and
`symbol-sort-key` for collision priority; we don't use them.

**Decision.** All `symbol` layers in `style.js` get
`text-allow-overlap: false` and a `symbol-sort-key` based on a
priority table (cities > countries > neighborhoods > streets > water
names > park names > POIs). Collisions resolve high-priority-first.

**Consequences.** Crowded areas show fewer but readable labels rather
than illegible overlap. No setting to expose; it's just better.

---

## ADR-085 — Halo width proportional to text size

**Context.** Halo (the colour stroke around label text) is fixed at
~2 px regardless of text size. At title sizes it looks anaemic; at
street-label sizes it looks heavy.

**Decision.** Compute halo as a proportional value:
`text-halo-width: max(1.2, text-size * 0.18)`. MapLibre supports
expressions in paint properties so this drops in.

**Consequences.** Cleaner contrast at every label size; no dial.

---

## ADR-086 — Inner map padding

**Context.** Today the map fills the poster card edge-to-edge inside
the frame. Labels and roads can render right at the trim, which
reads as cramped vs MapToPoster's typical generous margin.

**Decision.** New chip-group `mapPadding` in **Compose → Frame**:
`none (current) / cozy (8px) / breathing (16px) / loose (24px)`.
Inset uses `padding` on `#map-wrap` so the map is a smaller box
inside the poster card. Caption stays where it is.

**Consequences.** Critical features can't kiss the trim line. Tighter
visual hierarchy: poster has a clear "stage" with a frame of bg
colour around the map.

---

## ADR-087 — Caption / map height ratio cap

**Context.** A long subtitle + tagline + commemorative date can push
the caption block to ~25% of poster height, leaving the map crammed
above. MapToPoster keeps captions at <10% of height religiously.

**Decision.** Cap caption block at 18% of poster height via CSS
`max-height: 18%; overflow: hidden;` on `#caption`. If text doesn't
fit it ellipsises rather than steals map space. A "compact caption"
chip in Compose → Caption forces 12% for the truly minimalist look.

**Consequences.** The map always wins, and that's correct: it IS the
poster.

---

## ADR-088 — Title kerning curve by length

**Context.** Letter-spacing is a fixed value per `titleSize`. Short
titles ("NYC") look weak; long titles ("CONSTANTINOPLE") look
crammed. Designer typography always tunes letter-spacing to length.

**Decision.** Compute letter-spacing dynamically from title length:
`letter-spacing = max(2, 14 - title.length * 0.5)`. Falls between
2px (tight, for long titles) and 14px (airy, for 3-letter titles).
Applied via CSS variable set in JS on title input change.

**Consequences.** Posters look hand-tuned typography rather than
mechanical. No dial.

---

## ADR-089 — Coastline emphasis

**Context.** Water and land share an edge that MapLibre paints as
the boundary between two fills. With similar luminance values
(common in pastel themes) the coast disappears.

**Decision.** Optional `coastLine` toggle in Effects → Decorations.
When on, push an extra `line` layer for water polygon edges with
the bg-darken-15 colour at 0.6 weight. Templates can preset it
(Nautical, Riviera, Coral, Glacier all benefit).

**Consequences.** Coastlines read as deliberate graphic edges. Off
by default to keep the busy-detail count low; on for nautical
templates.

---

## ADR-090 — Monotone lock

**Context.** Some of the cleanest posters use one hue across every
element (Mono, Mono Dark) — water, land, roads, buildings all
versions of the same colour. Achieving this manually means dragging
9 colour pickers to similar values.

**Decision.** Toggle "Monotone lock" in Style → Palette. When on,
all palette entries auto-derive from a single `state.palette.bg`:
water = darken(bg, 0.15), green = darken(bg, 0.06), road = bg's
contrast colour (white on dark, black on light), etc. The user
edits ONE colour and the rest follow.

**Consequences.** One-colour posters become a 2-second job. Off by
default (user can still pick all 9 colours independently).

---

## ADR-091 — POI cap by zoom

**Context.** Today's POI cap is global. At z 18 the same cap of 25
crowds the screen because each POI is a 30 px chip and there's only
~600px to fit them.

**Decision.** Cap at render-time scales with zoom:
`effectiveCap = state.icons.density * (zoom < 14 ? 0.4 : zoom < 16 ? 0.7 : 1.0)`.
Low-zoom views show fewer POIs (more readable); high-zoom views
show more (there's room). Per-category densities (ADR-070) layer
on top.

**Consequences.** Auto-tunes density to canvas room. No dial.

---

## ADR-092 — Park polygon edge softening

**Context.** Park polygons render with hard fill-opacity edges that
clip cleanly against water/buildings. Looks digital. Designer maps
soften the edge so a park gradually fades into surrounding land.

**Decision.** Add an outer `line` layer for parks with a wide blur
(`line-blur: 8`, `line-color: park`, `line-opacity: 0.3`). The
existing fill stays sharp; the new blurred line gives a soft halo
around it. Off by default; on via a `parkSoften` toggle in
Effects → Decorations.

**Consequences.** Parks look painted rather than vector-clipped.

---

## ADR-093 — Subtle building drop shadow

**Context.** Without 3D pitch, buildings render as flat polygons.
With 3D pitch, the WebGL extrusions are heavy. Designer middle-ground:
flat shapes + a subtle drop shadow for depth.

**Decision.** Optional CSS `filter: drop-shadow(2px 2px 0 ...)` on
the building layer (achievable via a separate building-shadow line
layer in MapLibre at offset). New `buildingShadow` chip:
`none / subtle (1.5px) / lifted (3px)`. Subtle lifts buildings
slightly without the GPU cost of 3D.

**Consequences.** Posters get depth without 3D mode complexity.

---

## ADR-094 — Edge fade for roads / labels

**Context.** Roads and labels rendered right at the trim look like
they continue off-poster (which they do, but it visually disturbs
the framing). Designer maps fade them gently as they approach the
edge.

**Decision.** Add a CSS `mask-image: linear-gradient` overlay on
`#map-wrap` with opaque centre and 6 % alpha at every edge,
toggleable via `state.edgeFade`. Pure CSS; works in export.

**Consequences.** Posters feel framed rather than cropped.

---

## ADR-095 — Roundel city marker

**Context.** When the user puts a city's name as title, there's no
explicit "this is the city centre" mark on the map — the title
points generally, the map points exactly. Many posters use a small
filled circle at the geographic centre of the named place.

**Decision.** Toggle `centerRoundel` in Place → Search. When on,
draw a small filled circle (~6 px) + ring at the saved
`state.view.center` coordinate. Optional label text directly under
the roundel using the title text.

**Consequences.** "This poster is about THIS spot" is unambiguous.
Off by default; users who want the abstract minimalist look can keep
it that way.

---

## ADR-096 — Auto legend in corner

**Context.** With many road styles, building shapes, layer toggles
all visible, a viewer might want to know what dashed/dotted means.
A small legend in a corner solves this and gives the poster an
"informational" gravitas.

**Decision.** Toggle `legend` in Effects → Decorations. When on,
draw a small SVG legend in the bottom-left of the map showing only
the layers currently visible (water, roads, paths, buildings…)
with their colour. Auto-updates as toggles change. Uses no real
estate when empty.

**Consequences.** Posters feel reference-quality. Off by default.

---

## ADR-097 — Snap zoom to integer (or half) levels

**Context.** Fractional zoom levels (e.g. 13.4) cause MapLibre to
render labels at scaled-not-snapped positions, which can look
slightly fuzzy on a high-DPI export. Round-number zooms render
crisper.

**Decision.** Already partly done — there's a snap-to-half on
zoomend. Extend: when about to export, snap to the nearest integer
zoom (or half if integer would change the framing too much). Apply
as part of the export click handler before capture.

**Consequences.** Exports come out a touch sharper; no user-visible
behaviour change for live editing.

---

## ADR-098 — Designer typography pairings

**Context.** The Caption panel exposes weight/size/subtitle/coords as
4 independent dropdowns. A new user has to find the right pairing
themselves; a designer would already know "heavy title + italic
subtitle + caps + decimal" hangs together but "heavy + italic + caps
+ DMS" reads cluttered.

**Decision.** New chip-group `typographyPreset` in Caption: 6 curated
pairings — `Default`, `Editorial`, `Modern`, `Vintage`, `Brutalist`,
`Quiet`. Each sets all 4 fields atomically. State key
`state.typographyPreset`; templates can preset it.

**Consequences.** One click to "this caption looks like a designer
laid it out" instead of fiddling with four dropdowns.

---

## ADR-099 — Smart label size ramp by place class

**Context.** All cities show at the same size; all neighborhoods
show at the same size. Real designer maps scale by population: NYC
should render bigger than a small village, even on the same map.
OMT exposes a `rank` property (1-10ish) for places.

**Decision.** Replace fixed `text-size: 14` per class with an
expression keyed on `rank`:
`['interpolate', ['linear'], ['get', 'rank'], 1, 22, 6, 14, 10, 9]`.
High-rank places (capitals) render large; low-rank places (small
towns) render small. Holds within and across classes.

**Consequences.** Labels feel hierarchically meaningful rather than
class-uniform.

---

## ADR-100 — Print color profile preview

**Context.** Posters look one way on a calibrated screen and a
different way printed. Vibrant sRGB blues become muted in CMYK; bright
yellows lose saturation. Most users find out only when the print
arrives. MapToPoster outputs at a known DPI but doesn't help with
this either.

**Decision.** A toggle in **Compose → Frame**: "Preview as CMYK".
Applies a CSS `filter` chain that approximates the gamut shift —
slight desaturation, hue rotation toward green for cyan-ish colours,
etc. Not a true ICC profile (browsers don't expose that), but a good
empirical approximation that gives users a "what will it look like
printed" preview before they pay for the print.

**Consequences.** Fewer "but it looked great on screen" surprises.
Off by default; on as a sanity check before export. Works in
combination with the ADR-063 DPI selector for the full print-prep
workflow.

---

---

# Cohesion: making 100 features feel like one product

After ADR-001..100 the app has every feature it needs and is missing
none. What it's missing is *cohesion* — the way that good products
feel like one thing instead of a buffet. These 20 ADRs are about the
seams: discoverability, consistency, state visibility, forgiveness,
polish, personalisation. None of them add a new capability the app
doesn't already have. All of them make the existing capabilities
feel like they were designed together.

---

## ADR-101 — Sidebar search / instant-filter

**Context.** With 100 features across 4 main panels and ~16 sub-panels,
finding "where's the building shadow toggle again?" requires
clicking through. There's no discovery aid.

**Decision.** A small search field at the top of the sidebar (above
the 4 disclose-major buttons). As the user types, every chip /
toggle / slider / select label is matched against the query; matches
get a subtle highlight; non-matching panels collapse and dim. Empty
search restores everything. Pure DOM filter — no fuzzy matching
library; just `String.prototype.includes` on lowercased text content.

**Consequences.** Onboarding gets dramatically faster ("type
'shadow' → see it"). Power users still navigate via panels.

---

## ADR-102 — Command palette (Cmd-K / Ctrl-K)

**Context.** Heavy users rebuild the same posters across cities and
do the same 5 actions (apply template, set preset, randomize,
export). Going through the sidebar each time is friction.

**Decision.** Cmd-K (or Ctrl-K) opens a centred palette with fuzzy
matching across all template names, all sub-panel names, all chip
options ("multiply", "extreme", "watercolor"). Enter applies. Esc
closes. The palette is built from the same metadata the chip-groups
already declare (data-options) plus a static action list (Randomize,
Export, Reset).

**Consequences.** Pro-user flow. Reuses existing data-attributes —
no new state. Compact modal scoped to the keyboard.

---

## ADR-103 — Inline (?) help dots

**Context.** Sub-panels have tiny `<span class="sec-hint">` taglines
but most controls are unexplained. "What does Halftone vignette mean?
What's the difference between Soft and Hard card shadow?" The help
modal only covers shortcuts.

**Decision.** Add a `(?)` icon next to each `.sub-title` in the
sidebar. Click → small popover with a 1-2 sentence explainer.
Content lives in a single dictionary `HELP_TEXT[panelKey] = string`
in `js/lifecycle.js`. Editorial content, not generated.

**Consequences.** Discoverability for the dial-shy. Zero impact on
power users who'll never click the dots.

---

## ADR-104 — Tooltips on every interactive control

**Context.** Some chips have title attributes ("Click to enable" etc),
most don't. The user has no fast way to know what `★ Accent` does to
buildings without clicking it and seeing the change.

**Decision.** Audit every chip, toggle, slider, button — all get a
`title` attribute with a 1-line description. For chip-groups, the
description is added per-option via the existing `data-options`
schema (extend from `[value, label]` to `[value, label, tooltip?]`).
Browser-native tooltips — no custom popover library.

**Consequences.** Hover-discovery. Native browser tooltips are
ugly-but-universal; trade-off accepted.

---

## ADR-105 — Number-key panel shortcuts (1/2/3/4)

**Context.** Power-users navigate by keyboard. We have R/E/F/[/]
shortcuts but no way to jump panels. The 4 main categories are
exactly the kind of thing a number-row shortcut serves.

**Decision.** `1` opens & scrolls to Place, `2` Style, `3` Effects,
`4` Compose. `0` collapses all. Tucked into the existing
keyboard-shortcuts handler in `js/lifecycle.js`. Help modal updated.

**Consequences.** Two-keystroke navigation to any feature. Tiny
code change.

---

## ADR-106 — "Library" panel unifying saved items

**Context.** Three different "saved things" live in three different
places: Favourites (Place > Search), Profiles (Compose > Frame),
Themes (Style > Templates). Users have to remember which is where.
All three are essentially "named snapshots of (some subset of)
state".

**Decision.** New top-level **Library** panel that consolidates
Favourites, Profiles, and Themes into one view, with a chip-group at
the top to filter by type (`All / Favourites / Profiles / Themes`).
Each entry uses the same `.lib-item` card pattern. Existing
storage.js stays — only the rendering target changes.

**Consequences.** One mental model: Library = saved things. Fewer
"where did I save that" moments.

---

## ADR-107 — Consolidate Filter Stack + Map Filters + FX into Effects superpanel

**Context.** "Filter stack", "Map filters", and "FX mode" are three
adjacent panels that all do "modify how the rendered map looks".
They're conceptually one thing the user thinks of as "filters".

**Decision.** Effects panel is restructured into a single nested
hierarchy:
- **Filters** (the umbrella)
  - **Per-layer blends** (was Filter stack)
  - **Color adjustments** (was Map filters: saturation/contrast/hue)
  - **FX modes** (was FX mode chip-group)
  - **Time of day** (TOD select)
- **Decorations & mask** (unchanged)
- **Map icons** (unchanged)

**Consequences.** Three sub-panels become one. The user finds "all
the filter-y things" in one place.

---

## ADR-108 — Standard "saved item" card

**Context.** Right now `.fav-row`, `.preset` card, `.template` card,
`.filter-row` are four different card patterns for similar
"selectable saved thing" concepts. Visual rhythm suffers.

**Decision.** Introduce a single `.lib-card` CSS pattern (icon +
title + meta-line + optional thumbnail + delete button) and apply it
to all four. Existing classes alias to `.lib-card` for backward
compatibility during migration.

**Consequences.** Sidebar reads more rhythmic. Less custom CSS to
maintain. New saved-thing types automatically get the pattern.

---

## ADR-109 — Active-dial badge on panel headers

**Context.** Panels show no indication of whether they contain
non-default values. The user has to expand each one to see "yes I
changed something here". For 16 panels that's a lot of clicks.

**Decision.** Each `.disclose-sub`'s header gets a small dot or
counter when at least one of its dials differs from the active
template's value. Dot is theme-coloured. Pure CSS class
`.has-changes` toggled in `applyState()` after diffing the panel's
dials against the template snapshot.

**Consequences.** "Where did I change things?" answered in one
glance. Free benefit: a poster with all panels clean = "you haven't
deviated from the template" mental confirmation.

---

## ADR-110 — Diff-against-template badge

**Context.** Templates set ~20 dials. When the user fiddles, they
lose track of what they've moved away from baseline. "Reset preset"
exists but is all-or-nothing.

**Decision.** Header badge near the title showing
`Watercolor (5 changes)`. Click → modal listing each changed dial,
with a per-dial "↺ revert" button. Useful for "I tweaked too much,
let me revert just the two I regret".

**Consequences.** Forgiveness mechanic without losing work.
Surfaces the diff so users don't accumulate cruft they can't
identify.

---

## ADR-111 — "What's hidden" tooltip on Density slider

**Context.** ADR-081 strips detail at low density but doesn't say
*what* it stripped. User pulls slider to 30, doesn't see buildings
anymore, isn't sure if they were turned off or hidden.

**Decision.** Density slider's val-pill (currently shows `30%`)
becomes a small tooltip on hover listing the layers currently
hidden by density at that value: "Hiding: POIs, street labels,
neighborhoods, industrial, parking, military, buildings, paths,
cycleways". Calculated from the same `DENSITY_MIN` table that drives
the gate.

**Consequences.** Density goes from "magic value" to "transparent
recipe". Reduces surprise.

---

## ADR-112 — Auto-save indicator

**Context.** Persistence is silent (state to URL hash, LS, both).
Users coming from apps with explicit Save buttons may not realise
their work is sticking. A small "Saved" tick reassures.

**Decision.** Subtle "Saved at HH:MM" in the footer-note, updates
each time `persist()` fires. Throttled so rapid edits don't
hammer-update the timestamp. Pure cosmetic — no schema change.

**Consequences.** Confidence. Free.

---

## ADR-113 — Per-panel "Reset section" button

**Context.** The header `↺` button resets EVERYTHING. Users often
want to reset just the section they've been fiddling with (e.g.,
"my Map style is too cluttered, undo just that").

**Decision.** Each `.disclose-sub` body grows a small "↺ Reset
section" link in its footer. Resets every dial in that sub-panel
to the active template's value. Per-panel resets push their own
history entry so undo can recover.

**Consequences.** Surgical reset. Keeps the rest of your work.

---

## ADR-114 — Persistent action log (visible undo stack)

**Context.** Undo via Cmd-Z exists but the user has no idea what's
on the stack. They press Cmd-Z and either over-undo or stop too
early.

**Decision.** Help modal grows a "Recent actions" tab showing the
last 20 history entries with timestamps and a one-line description
("Toggled buildings off", "Set vignette: heavy"). Clicking a row
jumps the state machine back to that point.

**Consequences.** History becomes navigable, not opaque. Generated
descriptions need a small dictionary (`pushHistory(label)`); the
existing `pushHistory()` callers update to pass labels.

---

## ADR-115 — Real template thumbnails (rendered at user's location)

**Context.** Template cards show CSS-faked previews (a generic road
+ water mock). Two issues: they don't represent the actual template
output, and they don't match the user's current location. Picking
templates is guesswork.

**Decision.** When the Templates panel opens, render each template
in turn against the user's current map view at low resolution
(pixelRatio 1.0, ~120×80 px) and use those as the card thumbnails.
Cached per (template × location), invalidated on location change.

**Consequences.** Picking a template becomes "pick the picture you
like". One-time cost ~5 seconds on first open per location.

---

## ADR-116 — Animation micro-interactions

**Context.** Chip toggles snap. Disclose panels animate but most
state changes don't. The app feels "instant" but also "stiff".
Designer apps polish micro-interactions.

**Decision.** Add subtle transitions to:
- Chip activation: 80ms scale-up bounce
- Layer button activation: 120ms colour fade
- Slider drag: a small live "+1" / "-1" floater near the thumb
- Toast appearance: spring-bounce in
- Panel header chevron rotation (already animated; tighter timing)

CSS-only (transitions + transforms). No JS changes.

**Consequences.** App feels polished without becoming slow. Easy to
revert if performance regresses.

---

## ADR-117 — Section breadcrumbs

**Context.** When a deep sub-panel is open, the user can't see
where they are in the IA without scrolling up. "Am I in Style or
Effects right now?"

**Decision.** When a sub-panel is open, a subtle breadcrumb appears
at the top of its body: `Style › Map style`. Clicking the parent
collapses back to it. Pure CSS pseudo-element with content from
data-attributes; no JS.

**Consequences.** Navigation feedback. Implicit hierarchy reminder.

---

## ADR-118 — Recently-used templates row

**Context.** Power users cycle through 3-4 favourite templates.
Finding them in a 28-card grid each time is friction.

**Decision.** Top of Templates panel shows a "Recently applied"
strip with the 5 most-recently-clicked templates as horizontal
chips. Stored in localStorage `osm-poster:recent-templates` as a
moving window.

**Consequences.** Common path is now one click. Doesn't disrupt
the gallery for new users.

---

## ADR-119 — Default location from geolocation

**Context.** First-time users land on Paris. Most users don't live in
Paris. The "wow moment" of seeing your own city as a poster is
diluted.

**Decision.** On first visit only, prompt for geolocation via
`navigator.geolocation.getCurrentPosition`. If granted, default the
map there at distance 6 km with the user's geocoded city name as
title. If denied / unavailable, fall back to Paris. Stored as
"first-visit complete" so we never prompt again.

**Consequences.** Stronger first-impression for non-Parisians.
Polite (single prompt, never re-asked).

---

## ADR-120 — Mobile floating action buttons

**Context.** Mobile users have to scroll past the entire sidebar to
reach the Export button. The 3 most-common actions (Randomize /
Export / Cycle templates) deserve always-visible shortcuts on
narrow screens.

**Decision.** At `<800px`, three floating buttons appear in the
bottom-right of the viewport (overlapping the map preview):
🎲 Randomize, 🔄 Cycle, ⬇ Export. Pure CSS positioning + show only
in mobile breakpoint. They mirror the existing handlers — no new
behaviour.

**Consequences.** One-tap to the most-used actions on mobile.
Desktop users never see them.

---



1, 2, 18 — state/persistence/quick wins (foundation).
3, 4, 7, 14 — decorative overlays (visual upgrade).
5, 6, 8, 9, 10 — interactive content (the soul of the app).
11, 12, 13 — export polish.
15, 16, 17, 19, 20 — UX polish.

ADR-101..120 — cohesion pass (after 100 ADRs of feature shipping, the
   work that ties everything into one product):
   Discoverability:    101 search · 102 ⌘K palette · 103 (?) dots ·
                       104 tooltips · 105 number-key panels
   Consistency:        106 Library panel (favs+profiles+themes) ·
                       107 Effects superpanel · 108 .lib-card pattern
   State visibility:   109 active-dial badges · 110 diff-from-template
                       badge · 111 Density what's-hidden tooltip ·
                       112 auto-save tick
   Forgiveness:        113 per-panel reset · 114 visible undo stack
   Polish:             115 real template thumbnails · 116 micro-
                       animations · 117 breadcrumbs
   Personalisation:    118 recent templates · 119 geolocation default ·
                       120 mobile FABs

ADR-058..060 — sidebar IA + control modernization + mobile pass.
ADR-081..100 — output-cleanliness pass (the rendered POSTER quality
   itself, vs ADR-061..080 which were about input ergonomics):
   081 + 082 + 083 — first ship: density dial + road hierarchy +
      zoom LOD give the biggest "designer cleaned this up" jump for
      the smallest amount of code.
   084 + 085 + 099 — label discipline: collision avoidance,
      proportional halo, rank-based size.
   086 + 087 + 094 — framing & breathing: inner padding,
      caption-height cap, edge fade.
   088 + 098 — typography polish: per-length kerning + designer
      pairings.
   089 + 092 + 093 + 095 — graphic richness: coastline, park
      softening, building drop-shadow, city roundel.
   090 + 091 + 096 + 097 + 100 — power-user / print: monotone lock,
      zoom-aware POI cap, auto-legend, integer-zoom snap on export,
      CMYK preview.

ADR-061..080 — MapToPoster-inspired roadmap (not yet shipped):
   065 + 061 + 077 — input ergonomics first (paste coords, frame in
   km, see real distance).
   072 + 080 + 078 — first-impression flow ("good start" + minimal
   template + auto-frame on city pick).
   064 + 062 + 075 — sharing & batch (theme files, profiles, URL
   batch render).
   067 + 074 + 068 + 070 — power-user comfort (compare, history,
   favourites, per-category POI).
   063 + 071 + 073 — print-quality plumbing (DPI, prefetch, trim
   guides).
   066 + 069 + 076 + 079 — refinements (lock, smart TOD, structured
   caption, background patterns).

All shipped in a single index.html file. No build step.
