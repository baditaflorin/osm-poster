// =====================================================================
// OSM Poster — pure data constants (no DOM, no state)
// Exposed under window.DATA so the main script can destructure cleanly:
//   const { PRESETS, ICON_CATEGORIES, ... } = DATA;
// Adding a new template = append to DATA.PRESETS + DATA.TEMPLATE_BLURBS.
// Adding a new layer    = append to DATA.LAYER_ORDER + DATA.LAYER_LABELS
//                          + the right group in DATA.LAYER_GROUPS.
// =====================================================================
window.DATA = (function () {

  // ---- Templates that may carry these state fields and reshape them
  //      when applied. ------------------------------------------------
  const TEMPLATE_FIELDS = [
    'frame', 'border', 'texture', 'compass', 'scale',
    // Caption / typography
    'titleWeight', 'titleSize', 'subtitleStyle', 'coordsStyle',
    'titleOrnament', 'captionDivider',
    // Map view & appearance
    'pitch', 'bearing', 'buildingHeight', 'buildingShading',
    'roofTone', 'parkOpacity', 'labelCase', 'roadCaps',
    // Filters & decorations
    'tod', 'mapSaturation', 'mapContrast', 'mapHue',
    'vignette', 'stars', 'cardShadow', 'frameOrnaments',
    'sketchFrame', 'realisticLight',
  ];

  // ---- Layers --------------------------------------------------------
  const LAYER_ORDER = [
    'water', 'rivers', 'ferries', 'piers',
    'parks', 'greenery', 'wetlands', 'peaks',
    'buildings', 'industrial', 'airports', 'military', 'parking',
    'roads', 'railways', 'paths', 'cycleways', 'aerialways',
    'boundaries',
    'cities', 'neighborhoods', 'countries', 'water_names', 'park_names', 'streets',
    'pois',
  ];
  const LAYER_LABELS = {
    water: 'Water', rivers: 'Rivers', ferries: 'Ferries', piers: 'Piers',
    parks: 'Parks', greenery: 'Greenery', wetlands: 'Wetlands', peaks: 'Peaks',
    buildings: 'Buildings', industrial: 'Industrial', airports: 'Airports', military: 'Military', parking: 'Parking',
    roads: 'Roads', railways: 'Rail', paths: 'Paths', cycleways: 'Cycle', aerialways: 'Cable car',
    boundaries: 'Borders',
    cities: 'Cities', neighborhoods: 'Hoods', countries: 'Countries',
    water_names: 'Water names', park_names: 'Park names', streets: 'Streets',
    pois: 'POIs',
  };
  const LAYER_GROUPS = [
    { name: 'Water',  items: [
      { key: 'water',     icon: '💧' },
      { key: 'rivers',    icon: '🌊' },
      { key: 'ferries',   icon: '⛴' },
      { key: 'piers',     icon: '🪵' },
    ]},
    { name: 'Nature', items: [
      { key: 'parks',     icon: '🌳' },
      { key: 'greenery',  icon: '🌿' },
      { key: 'wetlands',  icon: '🪷' },
      { key: 'peaks',     icon: '⛰' },
    ]},
    { name: 'Built',  items: [
      { key: 'buildings', icon: '🏙' },
      { key: 'industrial',icon: '🏭' },
      { key: 'airports',  icon: '✈️' },
      { key: 'military',  icon: '🪖' },
      { key: 'parking',   icon: '🅿️' },
    ]},
    { name: 'Transit',items: [
      { key: 'roads',     icon: '🛣' },
      { key: 'railways',  icon: '🚆' },
      { key: 'paths',     icon: '🥾' },
      { key: 'cycleways', icon: '🚴' },
      { key: 'aerialways',icon: '🚡' },
    ]},
    { name: 'Labels', items: [
      { key: 'cities',        icon: '🏙' },
      { key: 'neighborhoods', icon: '🏘' },
      { key: 'countries',     icon: '🌍' },
      { key: 'water_names',   icon: '💧' },
      { key: 'park_names',    icon: '🌳' },
      { key: 'streets',       icon: '🛤' },
      { key: 'boundaries',    icon: '🗺' },
    ]},
  ];

  // ---- Palette swatches ----------------------------------------------
  const PALETTE_KEYS = ['bg', 'water', 'green', 'urban', 'building', 'roof', 'road', 'rail', 'label', 'accent'];
  const PALETTE_LABELS = {
    bg: 'Bg', water: 'Water', green: 'Green', urban: 'Urban',
    building: 'Walls', roof: 'Roofs', road: 'Roads', rail: 'Rail',
    label: 'Labels', accent: 'Accent',
  };

  // ---- City quick-flys (3 iconic; search covers the rest) ------------
  const CITIES = [
    { name: 'PARIS',    coord: [2.3522, 48.8566],   zoom: 12 },
    { name: 'NEW YORK', coord: [-74.0060, 40.7128], zoom: 12 },
    { name: 'TOKYO',    coord: [139.6503, 35.6762], zoom: 11 },
  ];

  // ---- Map-icon categories (POI overlay) -----------------------------
  const ICON_CATEGORIES = [
    { key: 'food',        icon: '🍽',  label: 'Food',     pin: 'fork_and_sausage', classes: ['restaurant','cafe','fast_food','food_court','ice_cream','bar','pub','biergarten'] },
    { key: 'culture',     icon: '🎨',  label: 'Culture',  pin: 'palette',          classes: ['museum','art_gallery','gallery','arts_centre','theatre','cinema','library'] },
    { key: 'shopping',    icon: '🛍',  label: 'Shop',     pin: 'bag',              classes: ['shop','marketplace','mall','supermarket'] },
    { key: 'attractions', icon: '🏛',  label: 'Sights',   pin: 'flag',             classes: ['attraction','viewpoint','historic','monument','memorial','archaeological_site','castle','ruins'] },
    { key: 'religious',   icon: '⛪',  label: 'Religion', pin: 'arch',             classes: ['place_of_worship','church','mosque','temple','synagogue'] },
    { key: 'activity',    icon: '🎯',  label: 'Sport',    pin: 'barbell',          classes: ['sports','leisure','stadium','pitch','fitness_centre','swimming_pool','golf_course'] },
    { key: 'outdoors',    icon: '🌳',  label: 'Outdoor',  pin: 'campfire',         classes: ['park','garden','playground','picnic_site','beach','cave','campsite','fountain'] },
    { key: 'transit',     icon: '🚌',  label: 'Transit',  pin: 'bridge',           classes: ['bus_stop','bus_station','tram_stop','railway_station','station','aerodrome','helipad'] },
    { key: 'lodging',     icon: '🛏',  label: 'Stay',     pin: 'bed',              classes: ['hotel','hostel','motel','guest_house'] },
    { key: 'services',    icon: 'ℹ️',  label: 'Civic',    pin: 'lightbulb',        classes: ['hospital','clinic','pharmacy','information','tourist_information','fuel','charging_station'] },
  ];

  // ---- Compass SVG variants ------------------------------------------
  const COMPASS_VARIANTS = {
    classic: `
      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.7"/>
      <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.4"/>
      <polygon points="50,8 54,50 50,52 46,50" fill="currentColor"/>
      <polygon points="50,92 54,52 50,50 46,52" fill="currentColor" opacity="0.45"/>
      <polygon points="8,50 50,46 52,50 50,54" fill="currentColor" opacity="0.6"/>
      <polygon points="92,50 52,50 50,46 50,54" fill="currentColor" opacity="0.6"/>
      <text x="50" y="6" text-anchor="middle" font-size="8" fill="currentColor" font-family="ui-serif, Georgia">N</text>`,
    minimal: `
      <polygon points="50,12 56,52 50,48 44,52" fill="currentColor"/>
      <line x1="50" y1="48" x2="50" y2="86" stroke="currentColor" stroke-width="1.5" opacity="0.45"/>
      <text x="50" y="9" text-anchor="middle" font-size="10" fill="currentColor" font-weight="700">N</text>`,
    windrose: `
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.5"/>
      <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="0.4" opacity="0.3"/>
      <polygon points="50,4 55,50 50,52 45,50" fill="currentColor"/>
      <polygon points="50,96 55,52 50,50 45,52" fill="currentColor" opacity="0.4"/>
      <polygon points="4,50 50,45 52,50 50,55" fill="currentColor" opacity="0.55"/>
      <polygon points="96,50 52,50 50,45 50,55" fill="currentColor" opacity="0.55"/>
      <polygon points="22,22 49,49 51,51 23,23" fill="currentColor" opacity="0.32"/>
      <polygon points="78,22 51,49 49,51 77,23" fill="currentColor" opacity="0.32"/>
      <polygon points="22,78 49,51 51,49 23,77" fill="currentColor" opacity="0.32"/>
      <polygon points="78,78 51,51 49,49 77,77" fill="currentColor" opacity="0.32"/>
      <circle cx="50" cy="50" r="2" fill="currentColor"/>
      <text x="50" y="3" text-anchor="middle" font-size="7" fill="currentColor" font-family="ui-serif, Georgia">N</text>`,
  };

  // ---- Title ornament wrappers ---------------------------------------
  const ORNAMENTS = {
    none:      t => t,
    bullets:   t => '●  ' + t + '  ●',
    dashes:    t => '—  ' + t + '  —',
    brackets:  t => '[  ' + t + '  ]',
    asterisks: t => '✦  ' + t + '  ✦',
  };

  // ---- Road quick-mode preset (Place > Roads buttons) ----------------
  const ROAD_MODES = {
    off:      { roads: false, paths: false, streets: false, cycleways: false, ferries: false },
    simple:   { roads: true,  paths: false, streets: false, cycleways: false },
    detailed: { roads: true,  paths: true,  streets: true,  cycleways: true,  boundaries: true },
  };

  // ---- TOD CSS filter strings ----------------------------------------
  const TOD_FILTERS = {
    dawn:   'hue-rotate(-12deg) saturate(0.85) brightness(0.96)',
    golden: 'sepia(0.32) saturate(1.18) hue-rotate(-12deg)',
    dusk:   'hue-rotate(15deg) saturate(0.90) brightness(0.84)',
    night:  'brightness(0.66) saturate(0.65) contrast(1.05)',
  };

  // ---- Sample mask SVG (torn paper edge) -----------------------------
  const SAMPLE_MASK_DATAURL = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path fill="black" d="M 3,4 Q 18,2 32,4 Q 50,1 68,3 Q 84,2 96,5 Q 98,20 96,38 Q 99,55 97,72 Q 96,88 95,97 Q 78,95 60,97 Q 42,99 24,96 Q 10,98 3,95 Q 5,80 3,62 Q 1,45 4,28 Q 2,14 3,4 Z"/>
    </svg>`);

  // ---- Pinhead CDN base ---------------------------------------------
  const PINHEAD_BASE = 'https://cdn.jsdelivr.net/gh/waysidemapping/pinhead@main/icons/';

  return {
    TEMPLATE_FIELDS,
    LAYER_ORDER, LAYER_LABELS, LAYER_GROUPS,
    PALETTE_KEYS, PALETTE_LABELS,
    CITIES, ICON_CATEGORIES,
    COMPASS_VARIANTS, ORNAMENTS, ROAD_MODES, TOD_FILTERS,
    SAMPLE_MASK_DATAURL, PINHEAD_BASE,
  };
})();
