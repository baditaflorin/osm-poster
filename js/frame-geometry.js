// =====================================================================
// OSM Poster — frame aspect-ratio geometry (single source of truth)
//
// FRAME_ASPECT MUST mirror the `aspect-ratio` values on the
// `.poster-wrap.frame-*` rules in css/poster.css. js/export.js's PDF
// path uses mmForFrame() to size the printed page from these ratios —
// if they drift out of sync with the CSS, the PDF page comes out a
// different shape than the on-screen poster and html-to-image's PNG
// gets non-uniformly stretched to fit it (see test/frame-aspect.test.js,
// which fails on drift, and CLAUDE.md changelog for the original bug:
// portrait/landscape/story frames rendered squished in PDF exports
// because SIZE_PRESETS.mm used ISO-paper ratios instead of each
// frame's actual on-screen ratio).
// =====================================================================
window.FRAME_GEOMETRY = (function () {
  const FRAME_ASPECT = {
    portrait:  2 / 3,     // css: aspect-ratio: 2 / 3
    square:    1,         // css: aspect-ratio: 1 / 1
    landscape: 3 / 2,      // css: aspect-ratio: 3 / 2
    story:     9 / 16,     // css: aspect-ratio: 9 / 16
    a4:        1 / 1.414,  // css: aspect-ratio: 1 / 1.414
    banner:    3 / 1,      // css: aspect-ratio: 3 / 1
  };

  function round1(n) { return Math.round(n * 10) / 10; }

  // Given an export tier's nominal "long edge" in mm and a frame key,
  // return [widthMm, heightMm] at that frame's aspect ratio. Portrait-ish
  // frames (ratio <= 1) keep the long edge as height; wider-than-tall
  // frames (ratio > 1) keep it as width — so every frame at a given
  // export tier prints at a comparable physical scale, and the page's
  // own aspect ratio always matches the live preview.
  function mmForFrame(longEdgeMm, frame) {
    const ar = FRAME_ASPECT[frame] || FRAME_ASPECT.a4;
    return ar <= 1
      ? [round1(longEdgeMm * ar), longEdgeMm]
      : [longEdgeMm, round1(longEdgeMm / ar)];
  }

  return { FRAME_ASPECT, mmForFrame };
})();

// Node (test) interop — browsers ignore this since `module` is undefined.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.FRAME_GEOMETRY;
}
