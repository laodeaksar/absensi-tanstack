import { useEffect, useRef, useState } from "react";

import type { AnswerInput } from "./types";

import { api } from "./api";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface AutosaveState {
  /** Status simpan saat ini */
  status: AutosaveStatus;
  /** Timestamp (ms epoch) terakhir tersimpan ke server, atau null bila belum pernah tersimpan sesi ini */
  savedAt: number | null;
}

/**
 * Simpan draf jawaban berkala selama siswa mengerjakan tugas.
 * - Hanya mengirim bila isi berubah sejak penyimpanan terakhir.
 * - Berhenti sendiri bila server menjawab ok=false (waktu habis / sudah dikumpulkan).
 * - Error jaringan atau sesi diabaikan; dicoba lagi pada putaran berikutnya.
 * Setelah submit berhasil, set `enabled` ke false.
 *
 * @returns `AutosaveState` — status simpan terkini untuk ditampilkan ke UI.
 */
export function useDraftAutosave(
  assignmentId: string,
  getAnswers: () => AnswerInput[],
  { enabled = true, intervalMs = 25_000 } = {},
): AutosaveState {
  const getRef = useRef(getAnswers);
  // Perbarui ref di effect (bukan saat render) supaya timer selalu memanggil versi terbaru
  useEffect(() => {
    getRef.current = getAnswers;
  });

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let last = "";

    const flush = async () => {
      if (stopped) return;
      const answers = getRef.current();
      const snap = JSON.stringify(answers);
      if (snap === last) return; // tidak ada perubahan, skip
      setStatus("saving");
      try {
        const r = await api.saveDraft(assignmentId, answers);
        if (stopped) return;
        if (r.ok) {
          last = snap;
          setSavedAt(Date.now());
          setStatus("saved");
        } else {
          stopped = true;
          setStatus("idle");
        }
      } catch {
        if (!stopped) setStatus("error");
        /* coba lagi pada putaran berikutnya */
      }
    };

    const timer = setInterval(() => void flush(), intervalMs);
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [assignmentId, enabled, intervalMs]);

  return { status, savedAt };
}
