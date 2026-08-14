import { Injectable, effect, signal } from '@angular/core';

const STORAGE_KEY = 'steadycalendar-docs-theme';

/**
 * Light/dark switching and live token overrides.
 *
 * Both work the same way and that is the point of the page they support: SteadyCalendar
 * has no theme API beyond its CSS custom properties, so "dark mode" is just a block of
 * `--sc-*` values set on an ancestor. Nothing is recompiled and the calendar is never
 * told a theme changed — it re-reads the cascade like any other element.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<'light' | 'dark'>('light');

  /** Ad-hoc `--sc-*` values from the theming page's editor, applied on top of the mode. */
  readonly overrides = signal<Record<string, string>>({});

  constructor() {
    const stored = safeRead();
    if (stored === 'dark' || stored === 'light') this.mode.set(stored);

    effect(() => {
      const mode = this.mode();
      document.documentElement.setAttribute('data-theme', mode);
      safeWrite(mode);
    });

    effect(() => {
      const overrides = this.overrides();
      const root = document.documentElement;
      // Clear first: an override removed from the map has to be removed from the element
      // too, otherwise "reset" would leave the last value stuck in the inline style.
      for (const name of Array.from(root.style)) {
        if (name.startsWith('--sc-')) root.style.removeProperty(name);
      }
      for (const [name, value] of Object.entries(overrides)) {
        root.style.setProperty(name, value);
      }
    });
  }

  toggle(): void {
    this.mode.update((m) => (m === 'light' ? 'dark' : 'light'));
  }

  setToken(name: string, value: string): void {
    this.overrides.update((current) => ({ ...current, [name]: value }));
  }

  resetTokens(): void {
    this.overrides.set({});
  }
}

/** localStorage throws in private-mode Safari and when cookies are blocked entirely. */
function safeRead(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeWrite(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Persisting the preference is a nicety, not a requirement.
  }
}
