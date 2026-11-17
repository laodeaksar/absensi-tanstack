import { useEffect, useRef, useState } from "react";

const isEditable = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el?.tagName) return false;
  return (
    el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
  );
};

/**
 * Pintasan keyboard per baris: ↑ ↓ memilih baris, Esc membatalkan pilihan.
 * Tombol lain diteruskan ke `onKey`; kembalikan true bila tombol sudah ditangani.
 * Tidak aktif saat fokus di input atau saat `enabled` false (mis. modal terbuka).
 */
export function useRowShortcuts({
  ids,
  enabled = true,
  onKey,
}: {
  ids: string[];
  enabled?: boolean;
  onKey?: (key: string, id: string) => boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const latest = useRef({ ids, enabled, onKey, activeId });
  useEffect(() => {
    latest.current = { ids, enabled, onKey, activeId };
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { ids, enabled, onKey, activeId } = latest.current;
      if (
        !enabled ||
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        isEditable(e.target)
      )
        return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!ids.length) return;
        e.preventDefault();
        const i = activeId ? ids.indexOf(activeId) : -1;
        const next =
          e.key === "ArrowDown"
            ? Math.min(i + 1, ids.length - 1)
            : Math.max(i - 1, 0);
        setActiveId(ids[next]);
        return;
      }
      if (e.key === "Escape") {
        setActiveId(null);
        return;
      }
      if (!activeId || !ids.includes(activeId)) return;
      // Enter pada tombol/tautan yang sedang fokus dibiarkan bekerja seperti biasa
      if (e.key === "Enter" && (e.target as HTMLElement).closest("button, a"))
        return;
      if (onKey?.(e.key, activeId)) e.preventDefault();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    document
      .querySelector(`[data-row-id="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  /** Atribut untuk `<tr>`: penanda baris aktif dan klik untuk memilih baris. */
  const rowProps = (id: string) => ({
    "data-row-id": id,
    "aria-selected": activeId === id || undefined,
    className:
      activeId === id
        ? "bg-primary/10 outline-2 -outline-offset-2 outline-primary"
        : undefined,
    onClick: () => setActiveId(id),
  });

  return { activeId, setActiveId, rowProps };
}
