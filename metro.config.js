// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-maps and react-native-map-clustering use
// `codegenNativeComponent` from react-native, which is not available on web.
// Resolving them to an empty stub on web prevents a TypeError that crashes
// the ContextNavigator and makes expo-router report every route as a 404.
const NATIVE_ONLY_MODULES = ['react-native-maps', 'react-native-map-clustering'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && NATIVE_ONLY_MODULES.includes(moduleName)) {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
