// =====================================================================
// OSM Poster — keyboard shortcuts, help modal, onboarding hint
// Pure UX glue, no state mutation beyond opening/closing modals.
// =====================================================================

// =====================================================================
// ADR-015: Keyboard shortcuts
// =====================================================================
function inInput(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}
window.addEventListener('keydown', e => {
  if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); openHelp(); return; }
  if (e.key === 'Escape') { closeHelp(); return; }
  if (inInput(e)) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if (e.key === 'r' || e.key === 'R') { e.preventDefault(); document.getElementById('randomize').click(); }
  else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); document.getElementById('export').click(); }
  else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); document.body.classList.toggle('fullscreen-preview'); document.querySelector('aside').style.display = document.body.classList.contains('fullscreen-preview') ? 'none' : ''; setTimeout(() => map.resize(), 200); }
  else if (e.key === '[') { e.preventDefault(); cyclePreset(-1); }
  else if (e.key === ']') { e.preventDefault(); cyclePreset(1); }
  // ADR-105 — Number-key panel shortcuts. 1=Place 2=Style 3=Effects
  // 4=Compose · 0=collapse all. The 4 disclose-major elements are
  // queried fresh each press so dynamic IA changes are picked up.
  else if (/^[0-4]$/.test(e.key)) {
    e.preventDefault();
    const majors = document.querySelectorAll('aside > .disclose.disclose-major');
    if (e.key === '0') {
      majors.forEach(m => m.classList.remove('open'));
      return;
    }
    const idx = parseInt(e.key, 10) - 1;
    majors.forEach((m, i) => m.classList.toggle('open', i === idx));
    // Scroll the picked panel into view smoothly so it lands at the top.
    if (majors[idx]) majors[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// =====================================================================
// ADR-017: Help modal
// =====================================================================
function openHelp() { document.getElementById('helpModal').classList.add('open'); }
function closeHelp() { document.getElementById('helpModal').classList.remove('open'); }
document.getElementById('helpBtn').addEventListener('click', openHelp);

// Global reset — wipes everything to defaults. Local-storage entries
// (font, mask, edition counter, etc.) are cleared too, then a hash-less
// reload restarts the app on the default state.
bindEl('resetAllBtn', 'click', () => {
  if (!confirm('Reset everything to defaults? This clears your current poster, palette tweaks, uploaded font/mask, annotations, polaroids, and the URL hash.')) return;
  try {
    localStorage.removeItem('osm-poster:last');
    localStorage.removeItem('osm-poster:gpx');
    localStorage.removeItem('osm-poster:font');
    localStorage.removeItem('osm-poster:mask');
    // Edition counter intentionally preserved — it's a sequence, not state.
  } catch (_) {}
  location.href = location.pathname;
});
document.getElementById('closeHelp').addEventListener('click', closeHelp);
document.getElementById('helpModal').addEventListener('click', e => { if (e.target.id === 'helpModal') closeHelp(); });

// ADR-120 — Mobile floating action buttons. Reuse the existing button
// handlers rather than duplicating their logic.
bindEl('fabRandomize', 'click', () => document.getElementById('randomize').click());
bindEl('fabCycle',     'click', () => { const b = document.getElementById('cycleTemplatesBtn'); if (b) b.click(); });
bindEl('fabExport',    'click', () => document.getElementById('export').click());

// (Pinhead manual-picker modal removed — icons now render automatically
// from OSM POIs via the Map icons disclosure. loadPinhead() is kept and
// used by the POI overlay above.)

// =====================================================================
// ADR-020: Onboarding hint  +  ADR-080: "Try a beautiful start"
// =====================================================================
// ADR-080 — first-impression flow. The starter picks a tasteful
// template + a well-known city at a sensible scale. Each pick is
// stable per-load so the user gets a consistent first impression
// rather than a random throw of the dice. Cycles through 3 looks
// so reloading shows variety.
const _GOOD_START_LOOKS = [
  { template: 'editorial',  city: 'PARIS',    coord: [2.3522, 48.8566],   km: 6 },
  { template: 'watercolor', city: 'TOKYO',    coord: [139.6503, 35.6762], km: 8 },
  { template: 'travelGuide',city: 'NEW YORK', coord: [-74.0060, 40.7128], km: 6 },
];
function applyGoodStart() {
  const idx = Math.floor(Math.random() * _GOOD_START_LOOKS.length);
  const pick = _GOOD_START_LOOKS[idx];
  pushHistory();
  // Apply template (palette + frame + texture etc.) — same path the
  // template-card click handler uses.
  state.preset = pick.template;
  Object.assign(state, clonePreset(pick.template));
  // Move the camera to the picked city at the picked scale.
  const z = (typeof _zoomFromDistance === 'function')
    ? _zoomFromDistance(pick.km) : 12;
  map.flyTo({ center: pick.coord, zoom: z, bearing: 0, pitch: 0, duration: 1200 });
  state.caption.title = pick.city;
  document.getElementById('title').value = pick.city;
  document.getElementById('caption-title').textContent = pick.city;
  applyState();
  persist();
}

// ADR-119 — Geolocation default. On first visit, ask once for
// geolocation. If granted, fly the map to the user's coordinates and
// reverse-geocode for the title. If denied or errored, fall through
// to the existing Paris default. The prompt only fires once ever
// (gated by LS_VISITED), so the UX cost is "one prompt, ever".
async function tryGeolocationFirstVisit() {
  if (!navigator.geolocation || !navigator.geolocation.getCurrentPosition) return;
  // Skip if state was loaded from URL hash (user is following a share link).
  if (location.hash && location.hash.length > 5) return;
  // Skip if state was loaded from localStorage (returning user).
  try { if (localStorage.getItem(LS_KEY)) return; } catch {}
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 4000, maximumAge: 60 * 60 * 1000,
      });
    });
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    // Reverse-geocode to a name via Nominatim.
    let cityName = '';
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`, { headers: { 'Accept': 'application/json' } });
      const j = await r.json();
      cityName = (j && j.address && (j.address.city || j.address.town || j.address.village || j.address.county)) || '';
    } catch {}
    pushHistory('first-visit geolocation');
    map.flyTo({ center: [lng, lat], zoom: 12, duration: 1200 });
    state.view.center = [lng, lat];
    state.view.zoom = 12;
    if (cityName) {
      state.caption.title = cityName.toUpperCase();
      const titleEl = document.getElementById('title');
      if (titleEl) titleEl.value = state.caption.title;
      const ctEl = document.getElementById('caption-title');
      if (ctEl) ctEl.textContent = state.caption.title;
    }
    persist();
  } catch (e) {
    // Denial / timeout / no-position — fall through silently.
  }
}

window.addEventListener('load', () => {
  try {
    const goodBtn = document.getElementById('goodStartBtn');
    if (goodBtn) goodBtn.addEventListener('click', () => {
      applyGoodStart();
      const t = document.getElementById('onboardToast');
      if (t) t.classList.remove('show');
      try { localStorage.setItem(LS_VISITED, '1'); } catch (_) {}
    });
    if (!localStorage.getItem(LS_VISITED)) {
      const t = document.getElementById('onboardToast');
      t.classList.add('show');
      document.getElementById('dismissOnboard').addEventListener('click', () => {
        t.classList.remove('show');
        try { localStorage.setItem(LS_VISITED, '1'); } catch (e) {}
      });
      // ADR-119 — first-visit-only geolocation. Falls through silently
      // on denial; the existing Paris default stays in place.
      tryGeolocationFirstVisit();
    }
  } catch (e) {}
});
