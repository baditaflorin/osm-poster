// =====================================================================
// OSM Poster — cohesion pass (ADR-101..120)
// Discoverability + state visibility on top of the 100 features that
// already exist. None of this adds a new capability — it makes the
// existing capabilities easier to find, see, and reach.
// =====================================================================

// =====================================================================
// ADR-101 — Sidebar search / instant-filter
// =====================================================================
// As the user types into the searchbar above the disclose-major panels,
// every chip / toggle / slider / select label is matched against the
// query. Matches stay visible; non-matching panels collapse and dim.
// Empty query restores everything. Pure DOM filter — no library.
(function wireSidebarSearch() {
  const input = document.getElementById('sidebarSearch');
  if (!input) return;

  // Cache the searchable text per element on first run so we don't
  // re-query the DOM each keystroke. Searchable units = sub-panels +
  // any labelled control (chip, toggle, slider row).
  function textOf(el) {
    return (el.textContent || '').toLowerCase();
  }
  function searchableUnits() {
    return [
      ...document.querySelectorAll('aside .disclose-sub'),
      ...document.querySelectorAll('aside .chip'),
      ...document.querySelectorAll('aside .toggle'),
      ...document.querySelectorAll('aside .row'),
      ...document.querySelectorAll('aside .layer-btn'),
    ];
  }

  function applyFilter(q) {
    const aside = document.querySelector('aside');
    const query = (q || '').trim().toLowerCase();
    if (!query) {
      aside.classList.remove('search-active');
      // Clear all filter classes
      document.querySelectorAll('.search-hit, .search-miss').forEach(el => {
        el.classList.remove('search-hit', 'search-miss');
      });
      return;
    }
    aside.classList.add('search-active');
    // Walk every disclose-sub. If its text matches, OPEN its parent
    // disclose-major + the sub itself, mark hit. Otherwise mark miss.
    document.querySelectorAll('aside .disclose-sub').forEach(sub => {
      const hits = textOf(sub).includes(query);
      sub.classList.toggle('search-hit', hits);
      sub.classList.toggle('search-miss', !hits);
      if (hits) {
        sub.classList.add('open');
        const major = sub.closest('.disclose-major');
        if (major) major.classList.add('open');
      }
    });
  }

  input.addEventListener('input', () => applyFilter(input.value));
  // Esc clears the search; matches the modal-close affordance.
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { input.value = ''; applyFilter(''); input.blur(); }
  });
})();

// =====================================================================
// ADR-102 — Command palette (⌘K / Ctrl-K)
// =====================================================================
// A centred fuzzy-match overlay. Indexes every chip option, every
// disclose-sub, every static action ("Randomize", "Export") into a
// flat list of { label, sectionPath, action }. Renders matches as a
// scrollable list. Enter applies the highlighted action.
(function wireCommandPalette() {
  const overlay = document.getElementById('cmdPalette');
  const input = document.getElementById('cmdPaletteInput');
  const results = document.getElementById('cmdPaletteResults');
  if (!overlay || !input || !results) return;

  // Index built once per open. Cheap because the sidebar is static
  // after init (chip-groups already rendered, presets already in DOM).
  function buildIndex() {
    const items = [];
    // Chip options across all chip-groups: each option is "<key>: <label>".
    document.querySelectorAll('aside .chip-group[data-chip-key]').forEach(group => {
      const key = group.dataset.chipKey;
      let opts;
      try { opts = JSON.parse(group.dataset.options || '[]'); } catch { opts = []; }
      opts.forEach(([val, label]) => {
        items.push({
          label: `${key}: ${label}`,
          haystack: `${key} ${label} ${val}`.toLowerCase(),
          action: () => {
            // Click the matching chip — re-uses the chip-group's wired handler.
            const chip = group.querySelector(`.chip[data-value="${val}"]`);
            if (chip) chip.click();
          },
        });
      });
    });
    // Sub-panels: opening one is also useful as an action.
    document.querySelectorAll('aside .disclose-sub').forEach(sub => {
      const title = sub.querySelector('.disclose-title')?.textContent || '';
      const desc  = sub.querySelector('.disclose-desc')?.textContent || '';
      const major = sub.closest('.disclose-major');
      const majorName = major && major.dataset.crumb ? major.dataset.crumb : '';
      items.push({
        label: `Open: ${majorName} › ${title}`,
        haystack: `${majorName} ${title} ${desc}`.toLowerCase(),
        action: () => {
          if (major) major.classList.add('open');
          sub.classList.add('open');
          sub.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      });
    });
    // Static actions.
    [
      { label: '🎲 Randomize palette',     hk: 'randomize palette',  id: 'randomize' },
      { label: '🔄 Cycle templates',       hk: 'cycle templates',    id: 'cycleTemplatesBtn' },
      { label: '⬇ Export poster',          hk: 'export download',    id: 'export' },
      { label: '↺ Reset to template defaults', hk: 'reset defaults', id: 'reset' },
      { label: '⭐ Save current view',     hk: 'save favourite',     id: 'addFavBtn' },
      { label: '📦 Save export profile',   hk: 'save profile export',id: 'saveProfileBtn' },
      { label: '✨ Try a beautiful start', hk: 'beautiful start onboarding', id: 'goodStartBtn' },
      { label: '? Open help',              hk: 'help shortcuts',     id: 'helpBtn' },
    ].forEach(it => {
      items.push({
        label: it.label,
        haystack: it.hk,
        action: () => { const el = document.getElementById(it.id); if (el) el.click(); },
      });
    });
    return items;
  }

  let _index = [];
  let _highlighted = 0;
  function render(query) {
    const q = query.trim().toLowerCase();
    const matches = q
      ? _index.filter(it => it.haystack.includes(q)).slice(0, 30)
      : _index.slice(0, 30);
    _highlighted = Math.min(_highlighted, matches.length - 1);
    if (_highlighted < 0) _highlighted = 0;
    results.innerHTML = matches.map((it, i) =>
      `<div class="cmd-row${i === _highlighted ? ' active' : ''}" data-i="${i}">${escapeHtml(it.label)}</div>`
    ).join('') || '<div class="cmd-empty">No matches.</div>';
    results._matches = matches;
  }

  function open() {
    _index = buildIndex();
    _highlighted = 0;
    overlay.classList.add('open');
    input.value = '';
    render('');
    setTimeout(() => input.focus(), 50);
  }
  function close() { overlay.classList.remove('open'); }
  function commit() {
    const m = (results._matches || [])[_highlighted];
    if (m) m.action();
    close();
  }

  // Cmd-K / Ctrl-K opens. Avoid hijacking when typing in another input.
  window.addEventListener('keydown', e => {
    const key = (e.key || '').toLowerCase();
    if ((e.metaKey || e.ctrlKey) && key === 'k') {
      e.preventDefault();
      open();
      return;
    }
    if (overlay.classList.contains('open')) {
      if (key === 'escape') { e.preventDefault(); close(); }
      else if (key === 'enter') { e.preventDefault(); commit(); }
      else if (key === 'arrowdown') { e.preventDefault(); _highlighted++; render(input.value); }
      else if (key === 'arrowup')   { e.preventDefault(); _highlighted = Math.max(0, _highlighted - 1); render(input.value); }
    }
  });
  input.addEventListener('input', () => render(input.value));
  results.addEventListener('click', e => {
    const row = e.target.closest('.cmd-row');
    if (!row) return;
    _highlighted = +row.dataset.i;
    commit();
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
})();

// =====================================================================
// ADR-103 — (?) help dots
// =====================================================================
// Each .sub-title can grow a (?) icon; clicking it shows a small
// popover with editorial text from HELP_TEXT. Triggered automatically
// for any .sub-title with a data-help attribute.
const HELP_TEXT = {
  density:        'The Density slider strips detail progressively as you slide left. 100 = full detail; 0 = bg + water + motorways only. Each step hides one or more layers (POIs → labels → buildings → minor roads → rivers).',
  road_hierarchy: 'How loud the difference between motorway and minor lanes is. Flat = same weight; Extreme = motorway 8× thicker than minor — the MapToPoster look.',
  filter_stack:   'Photoshop-style blend layers stacked over the map. Each filter targets a stratum (All / Background / Buildings / Foreground) and blends with everything beneath it. Top of the list paints on top.',
  fx_mode:        'Aggressive SVG filters applied to the entire map: Glitch (RGB shift), Halftone (newsprint dots), Melt (turbulence warp), Bloom (neon overdrive), Posterize (Andy Warhol bands).',
  monotone:       'Monotone lock derives every palette colour from the bg colour. Edit one swatch and the rest follow. Great for posters with a single-hue mood.',
  bg_pattern:     'A subtle pattern painted *behind* the map (visible through transparent areas of the bg color and through trim guides). Pure CSS, captured in exports.',
  cmyk_preview:   'Approximates the gamut shift print would introduce: vibrant blues and magentas desaturate, hues drift slightly. Not a true ICC profile — a sanity check before you order.',
};
(function wireHelpDots() {
  document.querySelectorAll('.sub-title[data-help]').forEach(t => {
    const key = t.dataset.help;
    const txt = HELP_TEXT[key];
    if (!txt) return;
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'help-dot';
    dot.textContent = '?';
    dot.title = txt; // browser tooltip as a fallback
    dot.addEventListener('click', e => {
      e.stopPropagation();
      // Toggle a popover. Single popover at a time — hide others first.
      document.querySelectorAll('.help-pop').forEach(p => p.remove());
      if (dot._popOpen) { dot._popOpen = false; return; }
      const pop = document.createElement('div');
      pop.className = 'help-pop';
      pop.textContent = txt;
      dot.parentNode.insertBefore(pop, dot.nextSibling);
      dot._popOpen = true;
      // Click anywhere else closes it.
      setTimeout(() => {
        const off = (ev) => {
          if (ev.target.closest('.help-pop') || ev.target === dot) return;
          pop.remove();
          dot._popOpen = false;
          document.removeEventListener('click', off, true);
        };
        document.addEventListener('click', off, true);
      }, 0);
    });
    t.appendChild(dot);
  });
})();

// =====================================================================
// ADR-111 — Density "what's hidden" tooltip
// =====================================================================
// The density val-pill (currently shows "30%") gets a title attribute
// listing the layers hidden at that value. Computed from the same
// DENSITY_MIN table that drives the gate in style.js. Keeps pace with
// slider drag so the tooltip always reflects the current state.
const DENSITY_HIDE_LIST = [
  // [label, threshold] — sorted ascending; layer is hidden when density <= threshold.
  ['POIs', 80], ['street labels', 80],
  ['neighborhoods', 60], ['industrial', 60], ['parking', 60],
  ['military', 60], ['park names', 60],
  ['water names', 50],
  ['buildings', 40], ['paths', 40], ['cycleways', 40], ['aerialways', 40],
  ['boundaries', 30], ['greenery', 30],
  ['rivers', 20], ['rail', 20], ['parks', 20],
];
function _hiddenAtDensity(d) {
  return DENSITY_HIDE_LIST.filter(([_, t]) => d <= t).map(([n]) => n);
}
function updateDensityTooltip() {
  const slider = document.getElementById('densitySlider');
  const val    = document.getElementById('densityVal');
  if (!slider || !val) return;
  const d = parseInt(slider.value, 10) || 100;
  const hidden = _hiddenAtDensity(d);
  if (hidden.length === 0) {
    val.title = 'All layers visible.';
  } else {
    val.title = 'Hidden at this density:\n• ' + hidden.join('\n• ');
  }
}
const densitySliderEl = document.getElementById('densitySlider');
if (densitySliderEl) {
  densitySliderEl.addEventListener('input', updateDensityTooltip);
  updateDensityTooltip();
}
