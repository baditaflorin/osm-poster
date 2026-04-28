// =====================================================================
// OSM Poster — pure helpers (no DOM, no state mutation)
// Exposed under window.LIB so the main script can destructure cleanly:
//   const { lum, haloFor, darken, lighten, ... } = LIB;
// =====================================================================
window.LIB = (function () {

  // ---- Color utilities -----------------------------------------------

  // Darken a hex color by `amount` (0-1).
  function darken(hex, amount) {
    const m = hex.replace('#', '').match(/../g).map(h => parseInt(h, 16));
    return '#' + m.map(c => Math.max(0, Math.min(255, Math.round(c * (1 - amount)))).toString(16).padStart(2, '0')).join('');
  }

  // Lighten a hex color toward white by `amount` (0-1).
  function lighten(hex, amount) {
    const m = hex.replace('#', '').match(/../g).map(h => parseInt(h, 16));
    return '#' + m.map(c => Math.max(0, Math.min(255, Math.round(c + (255 - c) * amount))).toString(16).padStart(2, '0')).join('');
  }

  // Relative luminance (sRGB), 0-1.
  function lum(hex) {
    const m = hex.replace('#', '').match(/../g).map(h => parseInt(h, 16) / 255);
    const lin = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * lin(m[0]) + 0.7152 * lin(m[1]) + 0.0722 * lin(m[2]);
  }

  // Pick a halo color guaranteed to contrast `labelHex` against `bgHex`.
  function haloFor(labelHex, bgHex) {
    const ll = lum(labelHex), bl = lum(bgHex);
    if (Math.abs(ll - bl) > 0.35) return bgHex;
    return ll > 0.5 ? '#000000' : '#ffffff';
  }

  // HSL → hex (h: 0-360, s: 0-100, l: 0-100).
  function hsl(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  // ---- Coords / formatting -------------------------------------------

  function formatDecimalCoords(lat, lng) {
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}° ${ns} · ${Math.abs(lng).toFixed(4)}° ${ew}`;
  }

  function dms(deg, isLat) {
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = Math.round((abs - d - m / 60) * 3600);
    const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
    return `${d}° ${m}' ${s}" ${dir}`;
  }

  // ---- MapLibre helpers ----------------------------------------------

  // Dasharray pattern for a road style preset.
  function dashFor(style) {
    if (style === 'dashed') return [4, 1.5];
    if (style === 'dotted') return [0.5, 2];
    return null;
  }

  // ---- Random / PRNG -------------------------------------------------

  // Mulberry32 — tiny seedable PRNG.
  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // FNV-1a string → 32-bit int. Empty string → fresh random.
  function seedToInt(s) {
    if (!s) return Math.floor(Math.random() * 2147483647);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h | 0);
  }

  // ---- Resilience ----------------------------------------------------

  function reportError(err, ctx) {
    console.error('[OSM Poster]' + (ctx ? ' [' + ctx + ']' : ''), err);
    try {
      const t = document.getElementById('errorToast');
      if (t) {
        t.querySelector('.msg').textContent = (err && err.message) ? err.message : String(err);
        t.classList.add('show');
        clearTimeout(t._hide);
        t._hide = setTimeout(() => t.classList.remove('show'), 4000);
      }
    } catch (_) {}
  }

  function safe(fn, ctx, fallback) {
    return function (...args) {
      try { return fn.apply(this, args); }
      catch (e) { reportError(e, ctx); return fallback; }
    };
  }

  async function safeAsync(fn, ctx, fallback) {
    try { return await fn(); }
    catch (e) { reportError(e, ctx); return fallback; }
  }

  // ---- DOM helper that no-ops on missing elements --------------------

  function bindEl(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
    return el;
  }

  // ---- HTML escape ---------------------------------------------------

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  return {
    darken, lighten, lum, haloFor, hsl,
    formatDecimalCoords, dms,
    dashFor,
    mulberry32, seedToInt,
    reportError, safe, safeAsync,
    bindEl,
    escapeHtml,
  };
})();
