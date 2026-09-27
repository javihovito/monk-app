import type { FaceTheme } from '../src/index';

const THEME_KEY = 'monk-face-theme';

function stored(): FaceTheme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

/** Wires the #theme radio group: remembered choice, else the OS preference. */
export function setupThemeSwitch(onChange: (t: FaceTheme) => void): FaceTheme {
  const buttons = document.querySelectorAll<HTMLButtonElement>('#theme [role=radio]');
  const apply = (t: FaceTheme): void => {
    document.documentElement.dataset.theme = t;
    buttons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.theme === t)));
    onChange(t);
  };
  buttons.forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.theme as FaceTheme;
    apply(t);
    try { localStorage.setItem(THEME_KEY, t); } catch { /* storage unavailable */ }
  }));
  const initial = stored() ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  apply(initial);
  return initial;
}
