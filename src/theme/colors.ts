export type ThemeMode = 'light' | 'dark';

export interface ColorPalette {
  deepNavy: string;
  teal: string;
  white: string;
  success: string;
  warning: string;
  background: string;
  border: string;
  textSecondary: string;
  surface: string;
  text: string;
}

/** Brand colors, fixed across light and dark mode (headers, buttons, badges, pins). */
const brand = {
  deepNavy: '#042347',
  teal: '#168B8D',
  white: '#FFFFFF',
  success: '#16A34A',
  warning: '#D97706',
};

const lightPalette: ColorPalette = {
  ...brand,
  background: '#F5F7FA',
  border: '#E2E8F0',
  textSecondary: '#64748B',
  surface: '#FFFFFF',
  text: '#042347',
};

const darkPalette: ColorPalette = {
  ...brand,
  background: '#0B1220',
  border: '#233047',
  textSecondary: '#8FA3BF',
  surface: '#131C2E',
  text: '#E7EDF5',
};

export const palettes: Record<ThemeMode, ColorPalette> = {
  light: lightPalette,
  dark: darkPalette,
};

/** Static light-mode colors, for the few places outside React components (e.g. Stack header options that intentionally stay brand-navy in both themes). */
export const colors = lightPalette;
