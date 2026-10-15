// Dynamic Expo config: injects the Google Maps API key from the environment so
// it never lands in git. Everything else lives in app.json.
//
// Set the key in mobile/.env.local (gitignored -- Expo loads it automatically)
// or export it before running expo/eas:
//
//   echo 'GOOGLE_MAPS_API_KEY=AIza...' >> .env.local
//
// Without a key the app runs fine everywhere except the "Mapa" tab: on Android
// react-native-maps hard-crashes ("API key not found"), on iOS the map is
// blank. Create one at https://console.cloud.google.com -> enable
// "Maps SDK for Android" + "Maps SDK for iOS" -> APIs & Services -> Credentials.
// One key works for both platforms.
//
// Sentry (crash/error reports): the DSN goes in EXPO_PUBLIC_SENTRY_DSN (without it nothing
// is sent). Uploading source maps on native builds needs SENTRY_ORG, SENTRY_PROJECT and
// SENTRY_AUTH_TOKEN -- until those are set, eas.json skips the upload
// (SENTRY_DISABLE_AUTO_UPLOAD) so builds don't fail.
const { withSentry } = require('@sentry/react-native/expo');
const appJson = require('./app.json');

module.exports = () => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  const { expo } = appJson;

  const config = {
    ...expo,
    ios: {
      ...expo.ios,
      config: { ...(expo.ios && expo.ios.config), googleMapsApiKey: apiKey },
    },
    android: {
      ...expo.android,
      config: { ...(expo.android && expo.android.config), googleMaps: { apiKey } },
    },
  };

  return withSentry(config, {
    url: 'https://sentry.io/',
    organization: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  });
};
