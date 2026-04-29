// =====================================================================
// OSM Poster — version badge
// Async fetch of the latest GitHub Pages build vs the bundled commit;
// renders a coloured pill in the sidebar (latest / outdated / dev).
// =====================================================================

// =====================================================================
// Version badge
// Compares the SHA actually deployed by Pages (via the public API) to
// the latest commit on main. When the workflow is enabled, the build
// SHA is baked into data-build-sha — we prefer that. Otherwise the
// API lookup is the source of truth.
// =====================================================================
(async function checkVersion() {
  const badge = document.getElementById('versionBadge');
  if (!badge) return;
  const text = document.getElementById('versionText');
  const baked = badge.dataset.buildSha;
  const bakedFull = badge.dataset.buildFull;
  const bakedTime = badge.dataset.buildTime;
  const REPO = 'baditaflorin/osm-poster';

  text.textContent = '…';

  let deployedSha = null, deployedAt = null, latestSha = null;
  try {
    const headers = { 'Accept': 'application/vnd.github+json' };
    const [pagesR, commitsR] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}/pages/builds/latest`, { headers }),
      fetch(`https://api.github.com/repos/${REPO}/commits/main`, { headers }),
    ]);
    if (pagesR.ok) { const d = await pagesR.json(); deployedSha = d.commit; deployedAt = d.updated_at; }
    if (commitsR.ok) { const d = await commitsR.json(); latestSha = d.sha; }
  } catch (e) {}

  // Prefer baked SHA if the workflow injected it; otherwise use the
  // deployed SHA from the API. Fall back to latest main as a last resort.
  let shownSha, shownTime;
  if (baked && !baked.startsWith('__')) {
    shownSha = bakedFull || baked;
    shownTime = bakedTime;
  } else if (deployedSha) {
    shownSha = deployedSha;
    shownTime = deployedAt ? new Date(deployedAt).toLocaleString() : null;
  } else if (latestSha) {
    shownSha = latestSha;
  }

  if (!shownSha) {
    // Both API endpoints failed (likely anonymous rate limit, 60/hr per IP).
    // Don't strand the user with a useless "?" — show that the page is
    // running and link to GitHub for the latest commit.
    badge.classList.add('latest');
    text.textContent = 'live';
    badge.title = 'Could not reach the GitHub API (rate limit?). Click to view the latest commits.';
    badge.style.cursor = 'pointer';
    badge.addEventListener('click', () => window.open(`https://github.com/${REPO}/commits/main`, '_blank'));
    return;
  }

  const short = shownSha.slice(0, 7);
  text.textContent = short;
  badge.style.cursor = 'pointer';

  // Default click: open commit. Outdated state overrides to reload.
  const goCommit = () => window.open(`https://github.com/${REPO}/commit/${shownSha}`, '_blank');
  let clickHandler = goCommit;

  if (deployedSha && latestSha) {
    if (deployedSha === latestSha) {
      badge.classList.add('latest');
      badge.title = `v ${short} — latest deploy${shownTime ? '\nBuilt ' + shownTime : ''}\n\nClick to view commit`;
    } else {
      badge.classList.add('outdated');
      const latestShort = latestSha.slice(0, 7);
      badge.title = `v ${short} — Pages catching up\nLatest main: ${latestShort}${shownTime ? '\nLast deploy: ' + shownTime : ''}\n\nClick to refresh`;
      clickHandler = () => location.reload();
    }
  } else {
    badge.classList.add(baked && !baked.startsWith('__') ? 'latest' : 'unknown');
    badge.title = `v ${short}${shownTime ? '\n' + shownTime : ''}\n\nClick to view commit`;
  }

  badge.addEventListener('click', () => clickHandler());
})();
