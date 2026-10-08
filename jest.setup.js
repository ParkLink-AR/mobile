// Los stores persistidos (useAccountTypeStore, useSettingsStore) usan
// AsyncStorage directamente. Su NativeModule no
// existe en el entorno de test, así que hay que mockearlo explícitamente --
// ver https://react-native-async-storage.github.io/async-storage/docs/advanced/jest
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
