import * as WebBrowser from 'expo-web-browser';

// The Terms of Service and Privacy Policy live on the landing page -- the same pages the app
// stores link to. auth-service's TERMS_VERSION records which version each account accepted.
export const TERMS_URL = 'https://www.parklink.com.ar/terminos/';
export const PRIVACY_URL = 'https://www.parklink.com.ar/privacidad/';

/** Opens a legal page in the in-app browser. */
export function openLegalPage(url: string): void {
  WebBrowser.openBrowserAsync(url).catch(() => {});
}
