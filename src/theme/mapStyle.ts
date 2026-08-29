/**
 * Custom map style for react-native-maps (Apple Maps / Google Maps).
 * Hides all POI labels and icons (restaurants, hotels, landmarks, transit
 * icons, etc.) so only streets, roads and building outlines remain visible.
 * The app's own parking-spot markers are the only points shown on the map.
 *
 * Format: Google Maps JSON style array — react-native-maps accepts it for
 * both Android (Google Maps) and iOS (Apple Maps via MapKit bridge).
 */
export const MAP_STYLE = [
  // ── Hide all POI icons and labels ──────────────────────────────────────
  {
    featureType: 'poi',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  // ── Hide transit stations (bus stops, metro, etc.) ────────────────────
  {
    featureType: 'transit',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  // ── Keep roads visible and clean ──────────────────────────────────────
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ visibility: 'on' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text',
    stylers: [{ visibility: 'on' }],
  },
  // ── Keep water and green areas for orientation ────────────────────────
  {
    featureType: 'water',
    elementType: 'all',
    stylers: [{ visibility: 'on' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'all',
    stylers: [{ visibility: 'on' }],
  },
  // ── Administrative labels (neighbourhoods, city names) ────────────────
  {
    featureType: 'administrative',
    elementType: 'labels.text',
    stylers: [{ visibility: 'on' }],
  },
];
