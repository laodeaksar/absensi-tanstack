import { Monitor, Moon, Sun } from "lucide-react";

import type { ThemeMode } from "~/hooks/use-theme";
import { useTheme } from "~/hooks/use-theme";

const LABELS: Record<ThemeMode, string> = {
  light: "Terang",
  dark: "Gelap",
  system: "Otomatis",
};

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  system: "light",
  light: "dark",
  dark: "system",
};

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === "light") return <Sun className="size-4" />;
  if (mode === "dark") return <Moon className="size-4" />;
  return <Monitor className="size-4" />;
}

/**
 * Tombol ikon cycle 3-state: Otomatis ↔ Terang ↔ Gelap.
 * Cocok untuk header mobile (compact).
 */
export function ThemeToggleCompact() {
  const { mode, setMode } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setMode(NEXT_MODE[mode])}
      className="btn btn-ghost btn-square"
      title={`Tema: ${LABELS[mode]} — klik untuk ganti`}
      aria-label={`Ganti tema. Sekarang: ${LABELS[mode]}`}
    >
      <ThemeIcon mode={mode} />
    </button>
  );
}

/**
 * Grup tombol segmented 3-state untuk sidebar desktop.
 * Menampilkan label teks di bawah ikon.
 */
export function ThemeToggleBar() {
  const { mode, setMode } = useTheme();
  const modes: ThemeMode[] = ["light", "system", "dark"];

  return (
    <div
      role="group"
      aria-label="Pilih tema tampilan"
      className="join w-full"
    >
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={`join-item btn btn-sm flex-1 gap-1 ${
            mode === m
              ? "btn-primary"
              : "btn-ghost border border-base-300"
          }`}
          aria-pressed={mode === m}
          title={LABELS[m]}
        >
          <ThemeIcon mode={m} />
          <span className="text-xs">{LABELS[m]}</span>
        </button>
      ))}
    </div>
  );
}
