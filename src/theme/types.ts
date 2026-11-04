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
  /** Example text inside empty inputs: kept grey so an empty field never looks filled in. */
  placeholder: string;
  surface: string;
  text: string;
}
