#!/usr/bin/env node
// =====================================================================
// Regression test: js/frame-geometry.js's FRAME_ASPECT must stay in
// sync with the `aspect-ratio` values on `.poster-wrap.frame-*` in
// css/poster.css, and mmForFrame() must always produce a page whose
// mm dimensions carry that same ratio.
//
// Why this exists: PDF export (js/export.js) sizes the printed page
// from FRAME_ASPECT via mmForFrame(), then stretches the on-screen
// poster capture (which is sized by the CSS aspect-ratio) to fill that
// page with jsPDF's addImage(). If the two ratios disagree, the export
// comes out visibly squished/stretched relative to the live preview —
// this happened for real: an earlier hard-coded mm table used ISO
// paper ratios (~1:1.414) for the portrait/landscape/story frames
// instead of their actual 2:3 / 3:2 / 9:16 on-screen ratios (story was
// off by ~26%), and the "screen"/"4k" export sizes had no mm table at
// all, silently defaulting every frame to A4 portrait.
//
// Run with: node test/frame-aspect-ratio.test.js
// No dependencies — plain Node (fs, assert, vm).
// =====================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const EPS = 0.01; // relative tolerance for ratio comparisons

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok  - ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL - ${name}`);
    console.error(`       ${e.message}`);
  }
}

// ---- 1. Load js/frame-geometry.js the way the browser does (window.X) ----
const geomSrc = fs.readFileSync(path.join(ROOT, 'js/frame-geometry.js'), 'utf8');
const sandbox = {};
sandbox.window = sandbox; // so `window.FRAME_GEOMETRY = ...` lands on sandbox
require('vm').runInNewContext(geomSrc, sandbox, { filename: 'js/frame-geometry.js' });
const { FRAME_ASPECT, mmForFrame } = sandbox.FRAME_GEOMETRY;

// ---- 2. Parse the CSS aspect-ratio values for each .poster-wrap.frame-* ----
const cssSrc = fs.readFileSync(path.join(ROOT, 'css/poster.css'), 'utf8');
const cssRatios = {};
const rule = /\.poster-wrap\.frame-([a-z0-9]+)\s*\{[^}]*aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/g;
let m;
while ((m = rule.exec(cssSrc))) {
  const [, frame, w, h] = m;
  cssRatios[frame] = parseFloat(w) / parseFloat(h);
}

console.log('Frame aspect-ratio regression test');
console.log('===================================');

check('css/poster.css has at least the 6 documented frames', () => {
  ['portrait', 'square', 'landscape', 'story', 'a4', 'banner'].forEach(f => {
    assert.ok(f in cssRatios, `no aspect-ratio parsed for .frame-${f} in css/poster.css`);
  });
});

check('every CSS frame has a matching FRAME_ASPECT entry', () => {
  Object.keys(cssRatios).forEach(frame => {
    assert.ok(frame in FRAME_ASPECT, `FRAME_ASPECT is missing a "${frame}" entry present in css/poster.css`);
  });
});

check('FRAME_ASPECT matches css/poster.css for every frame (within 1%)', () => {
  Object.entries(cssRatios).forEach(([frame, cssRatio]) => {
    const jsRatio = FRAME_ASPECT[frame];
    const diff = Math.abs(jsRatio - cssRatio) / cssRatio;
    assert.ok(
      diff < EPS,
      `frame "${frame}": css aspect-ratio=${cssRatio.toFixed(4)} vs FRAME_ASPECT=${jsRatio.toFixed(4)} (${(diff * 100).toFixed(1)}% off)`
    );
  });
});

check('mmForFrame() output ratio matches FRAME_ASPECT for every frame, at every tier', () => {
  const tiers = [297, 420, 594]; // A4 / A3 / A2 long edges, matches SIZE_PRESETS in js/export.js
  Object.keys(FRAME_ASPECT).forEach(frame => {
    tiers.forEach(longEdge => {
      const [w, h] = mmForFrame(longEdge, frame);
      const ratio = w / h;
      const expected = FRAME_ASPECT[frame];
      const diff = Math.abs(ratio - expected) / expected;
      assert.ok(
        diff < EPS,
        `frame "${frame}" @ longEdge=${longEdge}: mm=[${w},${h}] ratio=${ratio.toFixed(4)} vs expected ${expected.toFixed(4)}`
      );
      // The long edge itself should show up unshortened as the larger
      // of the two mm dimensions (sanity check against silent truncation).
      assert.ok(Math.max(w, h) === longEdge, `frame "${frame}" @ longEdge=${longEdge}: long edge not preserved (got [${w},${h}])`);
    });
  });
});

console.log('===================================');
if (failures) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log('All checks passed.');
}
