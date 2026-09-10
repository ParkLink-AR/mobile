const { withAndroidManifest } = require('expo/config-plugins');

// @react-native-firebase/messaging ships its own AndroidManifest.xml declaring
//   com.google.firebase.messaging.default_notification_color = @color/white
//   com.google.firebase.messaging.default_notification_icon  = @drawable/...
// The expo-notifications config plugin sets those same keys to the ParkLink
// icon + brand colour. The Android manifest merger then fails with a conflict
// unless the app manifest declares tools:replace. This plugin adds it to our
// (winning) values.
//
// NOTE: config-plugin mods run last-registered-first, so this plugin MUST be
// listed BEFORE "expo-notifications" in app.json so it runs *after* it.
const KEYS = new Set([
  'com.google.firebase.messaging.default_notification_color',
  'com.google.firebase.messaging.default_notification_icon',
]);

module.exports = function withFirebaseNotificationManifestFix(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    for (const entry of application?.['meta-data'] ?? []) {
      if (KEYS.has(entry?.$?.['android:name'])) {
        entry.$['tools:replace'] = 'android:resource';
      }
    }
    return cfg;
  });
};
