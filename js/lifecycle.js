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

// (Pinhead manual-picker modal removed — icons now render automatically
// from OSM POIs via the Map icons disclosure. loadPinhead() is kept and
// used by the POI overlay above.)

// =====================================================================
// ADR-020: Onboarding hint
// =====================================================================
window.addEventListener('load', () => {
  try {
    if (!localStorage.getItem(LS_VISITED)) {
      const t = document.getElementById('onboardToast');
      t.classList.add('show');
      document.getElementById('dismissOnboard').addEventListener('click', () => {
        t.classList.remove('show');
        try { localStorage.setItem(LS_VISITED, '1'); } catch (e) {}
      });
    }
  } catch (e) {}
});
