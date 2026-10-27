import clsx, { type ClassValue } from 'clsx';

/** Klassen zusammenführen (bedingte Tailwind-Klassen) */
export function cn(...values: ClassValue[]): string {
  return clsx(values);
}
