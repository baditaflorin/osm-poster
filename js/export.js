// =====================================================================
// OSM Poster — export pipeline (PNG / PDF / SVG, A2/A3/A4/4K sizes)
// withMapAtPixelRatio is a pass-through (high-DPI bump disabled — was
// corrupting the WebGL context). skipFonts:true keeps html-to-image's
// webfont embedder from choking on the cross-origin MapLibre stylesheet.
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

// High-DPI map render via setPixelRatio is currently disabled — across
// some MapLibre 4.7 / WebGL contexts it dropped the GL context and broke
// PNG/PDF/SVG exports entirely. Falling back to capturing at the screen's
// native DPI; html-to-image's pixelRatio multiplier still upscales the
// caption, frame and overlays correctly. Map will look slightly softer
// on A2/A3 exports until we wire a safer high-DPI path.
async function withMapAtPixelRatio(_targetRatio, capture) {
  return await capture();
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
