export type ThemeMode = 'light' | 'dark';

export interface ColorPalette {
  deepNavy: string;
  teal: string;
  // Acento exclusivo de las pantallas del modo Propietario (tab bar, botones,
  // acentos) -- distingue de un vistazo en qué modo está la app. El modo
  // Conductor sigue usando `teal` en todos lados.
  ownerAccent: string;
  white: string;
  success: string;
  warning: string;
  background: string;
  border: string;
  textSecondary: string;
  surface: string;
  text: string;
}
