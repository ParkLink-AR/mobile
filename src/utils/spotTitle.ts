// Same limit and format parking-service enforces on a spot's title (see spot-title.ts there).
export const SPOT_TITLE_MAX_LENGTH = 60;

/** Every word starts with an uppercase letter and the rest is lowercase
 * ("COCHERA en PALERMO" -> "Cochera En Palermo"). Spacing is left as typed so it can be
 * applied on every keystroke; the backend collapses and trims it when saving. */
export function formatSpotTitle(text: string): string {
  return text.replace(/\S+/g, (word) => word.charAt(0).toLocaleUpperCase('es') + word.slice(1).toLocaleLowerCase('es'));
}
