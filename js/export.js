// =====================================================================
// OSM Poster — export pipeline (PNG / PDF / SVG, A2/A3/A4/4K sizes)
// withMapAtPixelRatio temporarily bumps MapLibre's pixelRatio so the map
// canvas is rendered at print resolution (otherwise html-to-image
// upscales the screen-DPI canvas and the map looks soft on A2/A3). The
// bump is capped, idle-awaited, watched for GL context loss, and falls
// back to a native-DPI capture if anything goes wrong, so the user still
// gets *some* export even on weak GPUs. skipFonts:true keeps
// html-to-image's webfont embedder from choking on the cross-origin
// MapLibre stylesheet.
// =====================================================================

// =====================================================================
// EXPORT (ADR-011, 012, 013)
// =====================================================================
const SIZE_PRESETS = {
  screen: { mul: 4 },
  a2:     { mul: 8, mm: { portrait: [420, 594], square: [594, 594], landscape: [594, 420], story: [420, 594], a4: [420, 594], banner: [594, 200] } },
  a3:     { mul: 6, mm: { portrait: [297, 420], square: [420, 420], landscape: [420, 297], story: [297, 420], a4: [297, 420], banner: [420, 140] } },
  a4:     { mul: 4, mm: { portrait: [210, 297], square: [297, 297], landscape: [297, 210], story: [210, 297], a4: [210, 297], banner: [297, 100] } },
  '4k':   { mul: 6 },
};

let jsPdfPromise;
function loadJsPdf() {
  if (!jsPdfPromise) {
    jsPdfPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js';
      s.onload = () => resolve(window.jspdf.jsPDF);
      s.onerror = () => reject(new Error('Could not load jsPDF'));
      document.head.appendChild(s);
    });
  }
  return jsPdfPromise;
}

// Progressive ladder of pixelRatios to try, from highest quality down.
// We start at the requested ratio (e.g. 8 for A2), and if the WebGL
// context bails — GL OOM, integrated-GPU limits, driver quirks — we
// retry one rung lower, then again, all the way down to native DPI.
// 1.0 is the floor and *cannot* fail because it's the screen's own
// canvas pixel count, so the user always gets some export.
//
// On a healthy desktop GPU the first rung succeeds and the map matches
// the html-to-image output 1:1 (sharp). On a low-VRAM laptop we degrade
// gracefully without exploding the export.
const MAP_RATIO_LADDER = [8, 6, 4, 2, 1];

async function withMapAtPixelRatio(targetRatio, capture) {
  // We now have THREE stacked MapLibre instances (bg / buildings / fg).
  // Each canvas needs its own pixelRatio bump to print sharp; otherwise
  // html-to-image upscales whichever was left at screen DPI and that
  // canvas looks soft. The ratchet logic still walks the same ladder,
  // but applies its choice to all three maps in lockstep.
  const dpr = window.devicePixelRatio || 1;
  const targets = [map, mapBuildings, mapFg].filter(m => m && typeof m.setPixelRatio === 'function');
  if (targetRatio <= dpr || !targets.length) {
    return await capture();
  }

  const origRatios = targets.map(m =>
    (typeof m.getPixelRatio === 'function' ? m.getPixelRatio() : null) ?? dpr);
  const canvases = targets.map(m => m.getCanvas());

  const rungs = MAP_RATIO_LADDER.filter(r => r <= targetRatio);
  if (!rungs.length) rungs.push(dpr);

  // Wait for every map to idle (or a timeout). 'idle' may fire on each
  // separately; await the slowest.
  const waitAllIdle = (ms) => Promise.all(targets.map(m => new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    try { m.once('idle', finish); } catch (_) { finish(); return; }
    setTimeout(finish, ms);
  })));

  const restoreAll = () => {
    targets.forEach((m, i) => {
      try { m.setPixelRatio(origRatios[i]); } catch (_) {}
      try { m.triggerRepaint(); } catch (_) {}
    });
  };

  try {
    let lastError;
    for (const ratio of rungs) {
      const lost = new Array(targets.length).fill(false);
      const handlers = canvases.map((c, i) => {
        const h = () => { lost[i] = true; };
        c.addEventListener('webglcontextlost', h);
        return h;
      });
      try {
        targets.forEach(m => m.setPixelRatio(ratio));
        await waitAllIdle(1800);
        if (lost.some(Boolean)) throw new Error('WebGL context lost at pixelRatio ' + ratio);
        const result = await capture();
        if (ratio !== rungs[0]) {
          console.info('[export] maps captured at pixelRatio', ratio, '(below requested', targetRatio + ')');
        }
        return result;
      } catch (e) {
        lastError = e;
        console.warn('[export] pixelRatio', ratio, 'failed; trying next rung:', e && e.message);
        restoreAll();
        await waitAllIdle(1500); // give GL contexts a moment to recover
      } finally {
        canvases.forEach((c, i) => c.removeEventListener('webglcontextlost', handlers[i]));
      }
    }
    throw lastError || new Error('Could not capture map at any pixelRatio');
  } finally {
    restoreAll();
  }
}

document.getElementById('export').addEventListener('click', async () => {
  const btn = document.getElementById('export');
  const originalText = btn.textContent;
  btn.textContent = 'Rendering…';
  btn.disabled = true;
  try {
    // ADR-029 — bump edition counter and stamp it on the poster
    setEditionDisplay(nextEdition());

    map.triggerRepaint();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const node = document.getElementById('poster');
    const fmt = document.getElementById('exportFormat').value;
    const sz = document.getElementById('exportSize').value;
    const mul = SIZE_PRESETS[sz]?.mul || 4;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    // ADR-073 — trim guides are a preview-only aid, never burned into
    // the export. Strip the class for the duration of capture and put
    // it back after, regardless of whether capture succeeds or throws.
    const trimWasOn = node.classList.contains('trim-on');
    if (trimWasOn) node.classList.remove('trim-on');
    // Capture wrapped in a high-DPI map render so the embedded map
    // canvas matches the html-to-image pixelRatio of the surrounding
    // poster (no more pixelated map on A2/A3/A4/4K exports).
    const capture = async () => {
      // skipFonts: html-to-image otherwise tries to inline @font-face rules
      // from every stylesheet, including the cross-origin MapLibre CSS at
      // unpkg. That throws SecurityError on cssRules access, falls back to
      // fetching the file, then mis-resolves its inline url("data:...")
      // icon refs as relative paths and 403s — killing the whole export.
      // The page's only fonts are system fonts + dynamic FontFace uploads,
      // neither of which the webfont embedder would handle anyway.
      const opts = { pixelRatio: mul, cacheBust: true, backgroundColor: state.palette.bg, skipFonts: true };
      if (fmt === 'svg') return await htmlToImage.toSvg(node, opts);
      return await htmlToImage.toPng(node, opts);
    };
    const result = await withMapAtPixelRatio(mul, capture);

    if (fmt === 'svg') {
      download(result, `osm-poster-${ts}.svg`);
    } else if (fmt === 'pdf') {
      const dataUrl = result;
      const jsPDF = await loadJsPdf();
      const sizeMm = (SIZE_PRESETS[sz]?.mm || {})[state.frame] || [210, 297];
      const orientation = sizeMm[0] > sizeMm[1] ? 'l' : 'p';
      const trimW = Math.min(...sizeMm), trimH = Math.max(...sizeMm);
      // ADR-026 — print bleed + corner crop marks
      const bleed = state.exportBleed ? 3 : 0;
      const pdf = new jsPDF({ unit: 'mm', format: [trimW + 2 * bleed, trimH + 2 * bleed], orientation });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      pdf.addImage(dataUrl, 'PNG', 0, 0, pw, ph);
      if (bleed) {
        pdf.setLineWidth(0.15); pdf.setDrawColor(0, 0, 0);
        const ml = 4, mo = 1;
        const corners = [
          { x: bleed,      y: bleed,      sx: -1, sy: -1 },
          { x: pw - bleed, y: bleed,      sx:  1, sy: -1 },
          { x: bleed,      y: ph - bleed, sx: -1, sy:  1 },
          { x: pw - bleed, y: ph - bleed, sx:  1, sy:  1 },
        ];
        corners.forEach(({ x, y, sx, sy }) => {
          pdf.line(x + sx * mo, y, x + sx * (mo + ml), y);
          pdf.line(x, y + sy * mo, x, y + sy * (mo + ml));
        });
      }
      pdf.save(`osm-poster-${ts}.pdf`);
    } else {
      const a = document.createElement('a');
      a.download = `osm-poster-${ts}.png`;
      a.href = result;
      a.click();
    }
  } catch (e) {
    // Surface a useful message even when the thrown value isn't an Error
    // instance (some libraries reject with strings/objects/undefined).
    const msg = e && e.message
      ? e.message
      : (typeof e === 'string' ? e : (e && e.name) ? e.name : JSON.stringify(e) || 'Unknown error');
    console.error('[export]', e);
    alert('Export failed: ' + msg + '\n\nDetails are in the browser console.');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
    // Restore trim guides if they were on before capture (ADR-073).
    if (state.showTrimGuides) {
      const node = document.getElementById('poster');
      if (node) node.classList.add('trim-on');
    }
  }
});

const bleedToggleEl = document.getElementById('bleedToggle');
if (bleedToggleEl) bleedToggleEl.addEventListener('change', e => {
  state.exportBleed = e.target.checked; persist();
});

// htmlToImage.toSvg returns a data URL whose payload is URI-encoded
// (data:image/svg+xml;charset=utf-8,<percent-encoded-svg>). The earlier
// download() blindly called atob() on the payload — which only works for
// base64 — so SVG exports threw 'InvalidCharacterError'. Decode based
// on the data URL's actual encoding.
function dataUrlToText(url) {
  if (typeof url !== 'string' || !url.startsWith('data:')) return url;
  const commaIx = url.indexOf(',');
  const header = url.slice(0, commaIx);
  const payload = url.slice(commaIx + 1);
  if (header.includes(';base64')) {
    try { return atob(payload); } catch (_) { return decodeURIComponent(payload); }
  }
  try { return decodeURIComponent(payload); } catch (_) { return payload; }
}
function download(svgOrDataUrl, name) {
  const text = dataUrlToText(svgOrDataUrl);
  const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
  const a = document.createElement('a');
  a.download = name;
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
