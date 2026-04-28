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

## Implementation order

1, 2, 18 — state/persistence/quick wins (foundation).
3, 4, 7, 14 — decorative overlays (visual upgrade).
5, 6, 8, 9, 10 — interactive content (the soul of the app).
11, 12, 13 — export polish.
15, 16, 17, 19, 20 — UX polish.

All shipped in a single index.html file. No build step.
