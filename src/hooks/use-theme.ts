import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "eduabsen_theme";
const THEME_LIGHT = "eduabsen";
const THEME_DARK = "eduabsen-dark";

function readStorage(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // SSR / private browsing — abaikan
  }
  return "system";
}

function applyTheme(mode: ThemeMode) {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const resolved =
    mode === "system"
      ? prefersDark
        ? THEME_DARK
        : THEME_LIGHT
      : mode === "dark"
        ? THEME_DARK
        : THEME_LIGHT;

  document.documentElement.setAttribute("data-theme", resolved);
}

/** Hook untuk membaca, mengubah, dan menyinkronkan preferensi tema aplikasi. */
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(readStorage);

  // Sinkronkan ke DOM dan localStorage setiap kali mode berubah
  useEffect(() => {
    applyTheme(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // abaikan
    }
  }, [mode]);

  // Pantau perubahan OS saat mode "system"
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
  };

  const cycle = () => {
    setModeState((prev) => {
      // urutan: system → light → dark → system
      if (prev === "system") return "light";
      if (prev === "light") return "dark";
      return "system";
    });
  };

  return { mode, setMode, cycle } as const;
}
