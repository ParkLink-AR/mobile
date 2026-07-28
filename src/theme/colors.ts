import lightPalette from './light';
import darkPalette from './dark';
import { ThemeMode, ColorPalette } from './types';

export const palettes: Record<ThemeMode, ColorPalette> = {
  light: lightPalette,
  dark: darkPalette,
};

/** Static light-mode colors, for the few places outside React components (e.g. Stack header options that intentionally stay brand-navy in both themes). */
export const colors = lightPalette;
