// =====================================================================
// OSM Poster — preset/template definitions
// Adding a new template: append a new entry to PRESETS with isTemplate:true,
// a palette + layers, plus any TEMPLATE_FIELDS dials. Add a one-line entry
// to TEMPLATE_BLURBS for the picker card description.
// =====================================================================
window.PRESET_DATA = (function () {
  const PRESETS = {
    blueprint: {
      name: 'Blueprint',
      palette: { bg: '#0a2540', water: '#1a3a5f', green: '#0f2c4d', urban: '#0d2a47', building: '#1f426e', road: '#ffffff', rail: '#a8c8ff', label: '#ffffff', accent: '#7fb3ff' },
      layers: { water: true, rivers: true, parks: false, greenery: false, buildings: false, industrial: false, railways: false, paths: false, airports: false, places: false, streets: false, pois: false },
      roadWeight: 0.7, roadStyle: 'solid', labelFont: 'Noto Sans Regular',
    },
    mono: {
      name: 'Mono Line',
      palette: { bg: '#ffffff', water: '#ffffff', green: '#ffffff', urban: '#ffffff', building: '#ffffff', road: '#111111', rail: '#444444', label: '#111111', accent: '#666666' },
      layers: { water: false, rivers: false, parks: false, greenery: false, buildings: false, industrial: false, railways: false, paths: false, airports: false, places: false, streets: false, pois: false },
      roadWeight: 0.6, roadStyle: 'solid', labelFont: 'Noto Sans Regular',
    },
    midnight: {
      name: 'Midnight',
      palette: { bg: '#0d0d14', water: '#161624', green: '#13131c', urban: '#1a1a26', building: '#1d1d2c', road: '#d4af37', rail: '#8b6914', label: '#e8c870', accent: '#ffd966' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: true, industrial: false, railways: false, paths: false, airports: false, places: true, streets: false, pois: false },
      roadWeight: 0.9, roadStyle: 'solid', labelFont: 'Noto Sans Medium',
    },
    vintage: {
      name: 'Vintage',
      palette: { bg: '#f4ecd8', water: '#bda280', green: '#c9b88a', urban: '#e0d0a8', building: '#d6c19e', road: '#6e3f24', rail: '#3a2410', label: '#3d2914', accent: '#7a4a2b' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: true, industrial: false, railways: true, paths: false, airports: false, places: true, streets: false, pois: false },
      roadWeight: 1.0, roadStyle: 'solid', labelFont: 'Noto Sans Italic',
    },
    pastel: {
      name: 'Pastel',
      palette: { bg: '#fef3f2', water: '#a8d8e8', green: '#c8e4c5', urban: '#fae3d9', building: '#f7d8c9', road: '#e88aa3', rail: '#b591a5', label: '#5b4f6e', accent: '#b8a8d8' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: true, industrial: false, railways: false, paths: false, airports: false, places: false, streets: false, pois: false },
      roadWeight: 1.2, roadStyle: 'solid', labelFont: 'Noto Sans Regular',
    },
    neon: {
      name: 'Neon',
      palette: { bg: '#000000', water: '#021a14', green: '#01170a', urban: '#080808', building: '#0d0d0d', road: '#00ff9d', rail: '#ff00aa', label: '#ff2bd6', accent: '#00e5ff' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: true, industrial: false, railways: true, paths: false, airports: false, places: false, streets: false, pois: false },
      roadWeight: 0.8, roadStyle: 'solid', labelFont: 'Noto Sans Bold',
    },
    parchment: {
      name: 'Parchment',
      palette: { bg: '#efe2bf', water: '#a89169', green: '#cbb583', urban: '#dac9a0', building: '#c8b48a', road: '#5d3a1a', rail: '#3a2410', label: '#3d2510', accent: '#8a5a2b' },
      layers: { water: true, rivers: true, parks: false, greenery: false, buildings: false, industrial: false, railways: false, paths: true, airports: false, places: true, streets: false, pois: false },
      roadWeight: 1.3, roadStyle: 'dashed', labelFont: 'Noto Sans Italic',
    },
    tron: {
      name: 'Tron',
      palette: { bg: '#020617', water: '#06283d', green: '#031f1c', urban: '#040a18', building: '#0a1430', road: '#22d3ee', rail: '#a855f7', label: '#67e8f9', accent: '#f472b6' },
      layers: { water: true, rivers: true, parks: false, greenery: false, buildings: true, industrial: false, railways: true, paths: false, airports: false, places: false, streets: false, pois: false },
      roadWeight: 0.7, roadStyle: 'solid', labelFont: 'Noto Sans Bold',
    },
    solarpunk: {
      name: 'Solarpunk',
      palette: { bg: '#fef9e7', water: '#88c9a1', green: '#7cb87a', urban: '#f5e6a8', building: '#e8d68a', road: '#d97706', rail: '#9f661a', label: '#3f5d3a', accent: '#d97706' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: true, industrial: false, railways: false, paths: true, airports: false, places: true, streets: false, pois: false },
      roadWeight: 1.0, roadStyle: 'solid', labelFont: 'Noto Sans Medium',
    },
    newspaper: {
      name: 'Newspaper',
      palette: { bg: '#f5f5f0', water: '#d8d8d0', green: '#e8e8e0', urban: '#ededdf', building: '#cccac0', road: '#1a1a1a', rail: '#1a1a1a', label: '#1a1a1a', accent: '#444444' },
      layers: { water: true, rivers: true, parks: true, greenery: false, buildings: true, industrial: false, railways: true, paths: false, airports: false, places: true, streets: false, pois: false },
      roadWeight: 0.7, roadStyle: 'solid', labelFont: 'Noto Sans Bold',
    },
    desert: {
      name: 'Desert',
      palette: { bg: '#f5d9a3', water: '#7eb6c4', green: '#c8a86a', urban: '#e8c280', building: '#c69155', road: '#8b3a1a', rail: '#5a2a10', label: '#4a2810', accent: '#c44d2e' },
      layers: { water: true, rivers: true, parks: false, greenery: true, buildings: true, industrial: false, railways: false, paths: false, airports: false, places: true, streets: false, pois: false },
      roadWeight: 1.1, roadStyle: 'solid', labelFont: 'Noto Sans Medium',
    },
  
    // ============= FULL TEMPLATES =================================
    // These also dictate frame/border/texture/compass/scale — clicking
    // one reshapes the whole poster, not just the palette.
  
    appleMin: {
      name: 'Apple Min',
      isTemplate: true,
      palette: { bg: '#fafafa', water: '#e8ecef', green: '#f0f3f0', urban: '#f5f5f5', building: '#ececec', road: '#1d1d1f', rail: '#86868b', label: '#1d1d1f', accent: '#007aff' },
      layers: { water: true, rivers: false, parks: false, greenery: false, buildings: false, industrial: false, roads: true, railways: false, paths: false, airports: false, boundaries: false, places: true, streets: false, pois: false },
      roadWeight: 0.5, roadStyle: 'solid', labelFont: 'Noto Sans Regular',
      frame: 'square', border: 'none', texture: 'none', compass: false, scale: false,
    },
    editorial: {
      name: 'Editorial',
      isTemplate: true,
      palette: { bg: '#f8f6ee', water: '#cdc9bd', green: '#dcdacf', urban: '#ebe7d8', building: '#bcb8a8', road: '#1a1a1a', rail: '#1a1a1a', label: '#1a1a1a', accent: '#c44d2e' },
      layers: { water: true, rivers: true, parks: true, greenery: false, buildings: true, industrial: false, roads: true, railways: true, paths: false, airports: false, boundaries: true, places: true, streets: false, pois: false },
      roadWeight: 0.7, roadStyle: 'solid', labelFont: 'Noto Sans Bold',
      frame: 'portrait', border: 'thin', texture: 'grain', compass: true, scale: false,
    },
    travelGuide: {
      name: 'Travel Guide',
      isTemplate: true,
      palette: { bg: '#f1e4c2', water: '#a89169', green: '#cbb583', urban: '#dac9a0', building: '#c8b48a', road: '#5d3a1a', rail: '#3a2410', label: '#3d2510', accent: '#c44d2e' },
      layers: { water: true, rivers: true, parks: false, greenery: false, buildings: false, industrial: false, roads: true, railways: false, paths: true, airports: false, boundaries: true, places: true, streets: false, pois: true },
      roadWeight: 1.3, roadStyle: 'dashed', labelFont: 'Noto Sans Italic',
      frame: 'portrait', border: 'double', texture: 'grain', compass: true, scale: true,
    },
    subway: {
      name: 'Subway',
      isTemplate: true,
      palette: { bg: '#ffffff', water: '#bee5f0', green: '#d4e8d4', urban: '#fafafa', building: '#f0f0f0', road: '#dd4444', rail: '#1a1a1a', label: '#1a1a1a', accent: '#007aff' },
      layers: { water: true, rivers: false, parks: true, greenery: false, buildings: false, industrial: false, roads: true, railways: true, paths: false, airports: false, boundaries: false, places: true, streets: false, pois: false },
      roadWeight: 1.6, roadStyle: 'solid', labelFont: 'Noto Sans Bold',
      frame: 'landscape', border: 'thin', texture: 'none', compass: false, scale: false,
    },
    risograph: {
      name: 'Risograph',
      isTemplate: true,
      palette: { bg: '#fef0f5', water: '#9ad8e5', green: '#a8d8a0', urban: '#fde4ec', building: '#f7c8d8', road: '#e91e63', rail: '#7c8fbc', label: '#1a1a2e', accent: '#00bcd4' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: true, industrial: false, roads: true, railways: false, paths: false, airports: false, boundaries: false, places: true, streets: false, pois: false },
      roadWeight: 1.3, roadStyle: 'solid', labelFont: 'Noto Sans Bold',
      frame: 'square', border: 'thin', texture: 'grain', compass: false, scale: false,
    },
    brutalist: {
      name: 'Brutalist',
      isTemplate: true,
      palette: { bg: '#e8e8e8', water: '#bababa', green: '#c0c0c0', urban: '#d4d4d4', building: '#888888', road: '#1a1a1a', rail: '#1a1a1a', label: '#1a1a1a', accent: '#1a1a1a' },
      layers: { water: true, rivers: false, parks: false, greenery: false, buildings: true, industrial: true, roads: true, railways: false, paths: false, airports: false, boundaries: false, places: true, streets: false, pois: false },
      roadWeight: 1.6, roadStyle: 'solid', labelFont: 'Noto Sans Bold',
      frame: 'portrait', border: 'bold', texture: 'none', compass: false, scale: false,
    },
    botanical: {
      name: 'Botanical',
      isTemplate: true,
      palette: { bg: '#f7f1de', water: '#9ec1a3', green: '#5c8b4a', urban: '#e8dab9', building: '#bba27a', road: '#5d4523', rail: '#3d2510', label: '#2c4a1d', accent: '#8b5a2b' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: false, industrial: false, roads: true, railways: false, paths: true, airports: false, boundaries: false, places: true, streets: false, pois: false },
      roadWeight: 0.9, roadStyle: 'solid', labelFont: 'Noto Sans Italic',
      frame: 'portrait', border: 'double', texture: 'grain', compass: true, scale: false,
    },
    cyberpunk: {
      name: 'Cyberpunk',
      isTemplate: true,
      palette: { bg: '#0a0014', water: '#0a0a3a', green: '#0a0a14', urban: '#100020', building: '#1a0030', road: '#ff00aa', rail: '#00ffff', label: '#fff200', accent: '#00ffff' },
      layers: { water: true, rivers: true, parks: false, greenery: false, buildings: true, industrial: false, roads: true, railways: true, paths: false, airports: false, boundaries: false, places: true, streets: false, pois: false },
      roadWeight: 1.2, roadStyle: 'solid', labelFont: 'Noto Sans Bold',
      frame: 'portrait', border: 'thin', texture: 'none', compass: false, scale: false,
    },
    watercolor: {
      name: 'Watercolor',
      isTemplate: true,
      palette: { bg: '#fdfaf3', water: '#a8c8d8', green: '#bcd2a8', urban: '#f0e3d0', building: '#dabd9d', road: '#7a5a48', rail: '#5e4536', label: '#3a2e25', accent: '#c97a5e' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: false, industrial: false, roads: true, railways: false, paths: true, airports: false, boundaries: false, places: true, streets: false, pois: false },
      roadWeight: 0.7, roadStyle: 'solid', labelFont: 'Noto Sans Italic',
      frame: 'portrait', border: 'thin', texture: 'grain', compass: true, scale: false,
    },
    espresso: {
      name: 'Espresso',
      isTemplate: true,
      palette: { bg: '#3a2418', water: '#6b4438', green: '#4a3424', urban: '#4d2f1f', building: '#5e3a26', roof: '#a07654', road: '#e8c994', rail: '#d4a373', label: '#f5dfb8', accent: '#e8c994' },
      layers: { water: true, rivers: true, parks: false, greenery: false, buildings: true, industrial: false, roads: true, railways: false, paths: false, airports: false, boundaries: false, cities: true, neighborhoods: false, countries: false, water_names: false, park_names: false, streets: false, pois: false },
      roadWeight: 1.0, roadStyle: 'solid', labelFont: 'Noto Sans Medium',
      frame: 'square', border: 'double', texture: 'grain', compass: false, scale: false,
      cardShadow: 'soft', roofTone: 'lighter', labelCase: 'uppercase',
      titleWeight: 'bold', titleSize: 'medium', captionDivider: 'double',
    },
    constructivist: {
      name: 'Constructivist',
      isTemplate: true,
      palette: { bg: '#f4e8d8', water: '#1a1a1a', green: '#1a1a1a', urban: '#f0d8c0', building: '#1a1a1a', road: '#d62828', rail: '#1a1a1a', label: '#1a1a1a', accent: '#d62828' },
      layers: { water: true, rivers: false, parks: false, greenery: false, buildings: true, industrial: false, roads: true, railways: false, paths: false, airports: false, boundaries: false, places: true, streets: false, pois: false },
      roadWeight: 1.8, roadStyle: 'solid', labelFont: 'Noto Sans Bold',
      frame: 'portrait', border: 'bold', texture: 'none', compass: false, scale: false,
    },
    aurora: {
      name: 'Aurora',
      isTemplate: true,
      palette: { bg: '#0d1b2a', water: '#1b4332', green: '#2d6a4f', urban: '#1a2433', building: '#243447', roof: '#3d5a7a', road: '#95d5b2', rail: '#52b788', label: '#d8f3dc', accent: '#7dd3fc' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: true, industrial: false, roads: true, railways: false, paths: false, airports: false, boundaries: false, cities: true, neighborhoods: false, countries: false, water_names: false, park_names: false, streets: false, pois: false },
      roadWeight: 0.9, roadStyle: 'solid', labelFont: 'Noto Sans Medium',
      frame: 'portrait', border: 'thin', texture: 'none', compass: true, scale: false,
      stars: true, cardShadow: 'float', tod: 'night', roofTone: 'lighter',
      titleSize: 'large', titleWeight: 'bold', subtitleStyle: 'italic',
    },
  
    // === 4 NEW TEMPLATES ===
  
    manhattan: {
      name: 'Manhattan',
      isTemplate: true,
      palette: { bg: '#1a1f2e', water: '#0c4a6e', green: '#143524', urban: '#1f2a40', building: '#3b4a6b', roof: '#7a92b8', road: '#fcd34d', rail: '#94a3b8', label: '#f1f5f9', accent: '#fcd34d' },
      layers: { water: true, rivers: true, parks: true, greenery: false, buildings: true, industrial: false, roads: true, railways: false, paths: false, airports: false, boundaries: false, cities: true, neighborhoods: true, countries: false, water_names: false, park_names: false, streets: true, pois: false },
      roadWeight: 0.7, roadStyle: 'solid', labelFont: 'Noto Sans Bold',
      frame: 'portrait', border: 'thin', texture: 'none', compass: false, scale: false,
      pitch: 50, buildingHeight: 4.5, buildingShading: true,
      realisticLight: true, roofTone: 'lighter', cardShadow: 'float',
      titleSize: 'large', titleWeight: 'heavy', labelCase: 'uppercase',
    },
  
    sketchbook: {
      name: 'Sketchbook',
      isTemplate: true,
      palette: { bg: '#f4ecd8', water: '#8c7853', green: '#a8956a', urban: '#e8dab9', building: '#cdb892', roof: '#cdb892', road: '#3a2418', rail: '#3a2418', label: '#1f1408', accent: '#a04020' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: false, industrial: false, roads: true, railways: false, paths: true, airports: false, boundaries: false, cities: true, neighborhoods: false, countries: false, water_names: true, park_names: false, streets: false, pois: false },
      roadWeight: 1.1, roadStyle: 'dashed', labelFont: 'Noto Sans Italic',
      frame: 'portrait', border: 'none', texture: 'grain', compass: false, scale: false,
      sketchFrame: true, frameOrnaments: true, cardShadow: 'soft',
      roadCaps: 'round', labelCase: 'asis', captionDivider: 'wave',
      titleSize: 'medium', titleWeight: 'regular', subtitleStyle: 'italic',
      titleOrnament: 'bullets',
    },
  
    risoPop: {
      name: 'Riso Pop',
      isTemplate: true,
      palette: { bg: '#fff5e0', water: '#22d3ee', green: '#fde68a', urban: '#fef3c7', building: '#fbcfe8', roof: '#f0abfc', road: '#ec4899', rail: '#a855f7', label: '#0f172a', accent: '#22d3ee' },
      layers: { water: true, rivers: true, parks: true, greenery: false, buildings: true, industrial: false, roads: true, railways: false, paths: false, airports: false, boundaries: false, cities: true, neighborhoods: false, countries: false, water_names: false, park_names: false, streets: false, pois: false },
      roadWeight: 1.5, roadStyle: 'solid', labelFont: 'Noto Sans Bold',
      frame: 'square', border: 'bold', texture: 'halftone', compass: false, scale: false,
      cardShadow: 'hard', roofTone: 'accent', labelCase: 'uppercase',
      titleSize: 'large', titleWeight: 'heavy', captionDivider: 'double',
      mapSaturation: 130,
    },
  
    twilight: {
      name: 'Twilight',
      isTemplate: true,
      palette: { bg: '#1e1b4b', water: '#312e81', green: '#1e1b4b', urban: '#2e1065', building: '#3b0764', roof: '#7c3aed', road: '#fbbf24', rail: '#f472b6', label: '#fef3c7', accent: '#f472b6' },
      layers: { water: true, rivers: true, parks: false, greenery: false, buildings: true, industrial: false, roads: true, railways: true, paths: false, airports: false, boundaries: false, cities: true, neighborhoods: false, countries: false, water_names: false, park_names: false, streets: false, pois: false },
      roadWeight: 0.8, roadStyle: 'solid', labelFont: 'Noto Sans Medium',
      frame: 'portrait', border: 'thin', texture: 'none', compass: true, scale: false,
      pitch: 25, buildingHeight: 2, stars: true, vignette: 'soft',
      tod: 'dusk', cardShadow: 'float', roofTone: 'darker',
      titleSize: 'large', subtitleStyle: 'italic',
    },

    // === 4 MORE TEMPLATES (3 water-themed + 1 topographic) ===

    riviera: {
      name: 'Riviera',
      isTemplate: true,
      palette: { bg: '#fef3d7', water: '#3aa3c4', green: '#a3c499', urban: '#fde9c0', building: '#f0d8a0', roof: '#d8a878', road: '#c0392b', rail: '#8b3a1a', label: '#3a2418', accent: '#e67e22' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: true, industrial: false, roads: true, railways: false, paths: true, airports: false, boundaries: false, cities: true, neighborhoods: false, countries: false, water_names: true, park_names: false, streets: false, pois: false },
      roadWeight: 1.0, roadStyle: 'solid', labelFont: 'Noto Sans Medium',
      frame: 'landscape', border: 'thin', texture: 'grain', compass: true, scale: true,
      cardShadow: 'soft', roofTone: 'lighter', parkOpacity: 'normal',
      titleSize: 'large', titleWeight: 'medium', subtitleStyle: 'italic',
      captionDivider: 'wave',
    },

    nautical: {
      name: 'Nautical',
      isTemplate: true,
      palette: { bg: '#f4ede0', water: '#1e3a5f', green: '#dfd6c2', urban: '#f4ede0', building: '#e8dcc4', roof: '#c8b48a', road: '#1a1a1a', rail: '#1a1a1a', label: '#1e3a5f', accent: '#c0392b' },
      layers: { water: true, rivers: true, parks: false, greenery: false, buildings: true, industrial: false, roads: true, railways: false, paths: false, airports: false, boundaries: true, cities: true, neighborhoods: false, countries: false, water_names: true, park_names: false, streets: false, pois: false },
      roadWeight: 0.6, roadStyle: 'dotdash', labelFont: 'Noto Sans Bold',
      frame: 'portrait', border: 'double', texture: 'grain', compass: true, scale: true,
      cardShadow: 'soft', roofTone: 'darker', labelCase: 'uppercase',
      titleSize: 'medium', titleWeight: 'bold',
      titleOrnament: 'asterisks', captionDivider: 'double',
    },

    coral: {
      name: 'Coral',
      isTemplate: true,
      palette: { bg: '#fff4ec', water: '#5fc8d6', green: '#f5b7a8', urban: '#ffe4d4', building: '#f8c8b8', roof: '#e8a09a', road: '#ff6b8a', rail: '#c44569', label: '#5d2438', accent: '#ff6b8a' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: true, industrial: false, roads: true, railways: false, paths: false, airports: false, boundaries: false, cities: true, neighborhoods: false, countries: false, water_names: false, park_names: false, streets: false, pois: false },
      roadWeight: 1.2, roadStyle: 'solid', labelFont: 'Noto Sans Bold',
      frame: 'square', border: 'thin', texture: 'halftone', compass: false, scale: false,
      cardShadow: 'soft', roofTone: 'lighter', parkOpacity: 'bold',
      titleSize: 'large', titleWeight: 'heavy',
      mapSaturation: 115,
    },

    topo: {
      name: 'Topo',
      isTemplate: true,
      palette: { bg: '#f3eddc', water: '#9bb6a8', green: '#bfc99a', urban: '#ece2c8', building: '#d4c79a', roof: '#a89165', road: '#5a3a1a', rail: '#3a2410', label: '#2d1f0c', accent: '#8b4513' },
      layers: { water: true, rivers: true, parks: true, greenery: true, buildings: false, industrial: false, roads: true, railways: false, paths: true, airports: false, boundaries: true, cities: true, neighborhoods: true, countries: false, water_names: true, park_names: true, streets: false, pois: false },
      roadWeight: 0.7, roadStyle: 'longdash', labelFont: 'Noto Sans Italic',
      frame: 'a4', border: 'thin', texture: 'grain', compass: true, scale: true,
      cardShadow: 'soft', parkOpacity: 'subtle', labelCase: 'asis',
      titleSize: 'medium', titleWeight: 'medium', subtitleStyle: 'italic',
      captionDivider: 'dotted',
    },
  };
  // Short marketing copy for each full template
  const TEMPLATE_BLURBS = {
    appleMin:    'Square, white, system blue',
    editorial:   'Magazine grain & compass',
    travelGuide: 'Vintage with scale bar',
    subway:      'Transit-map landscape',
    risograph:   '2-color riso print, pink & cyan',
    brutalist:   'Concrete grays, hard edges',
    botanical:   'Forest greens on cream paper',
    cyberpunk:   'Neon magenta on midnight',
    watercolor:  'Soft pastel wash on cream',
    espresso:    'Coffee brown with cream lines',
    constructivist: 'Soviet poster: red, black, cream',
    aurora:      'Deep teal with sky-green roads',
    manhattan:   '3D skyline · sun-lit at 50° tilt',
    sketchbook:  'Wobbly hand-drawn travel journal',
    risoPop:     'Pink/cyan riso with hard shadow',
    twilight:    'Dusk + stars + atmospheric',
    riviera:     'Mediterranean coast on cream paper',
    nautical:    'Sea-chart navy on parchment',
    coral:       'Tropical reef pinks & turquoise',
    topo:        'Topographic survey, contour-style',
  };
  return { PRESETS, TEMPLATE_BLURBS };
})();
