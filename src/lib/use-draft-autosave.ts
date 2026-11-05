import { useEffect, useRef } from "react";

import type { AnswerInput } from "./types";

import { api } from "./api";

/**
 * Simpan draf jawaban berkala selama siswa mengerjakan tugas.
 * - Hanya mengirim bila isi berubah sejak penyimpanan terakhir.
 * - Berhenti sendiri bila server menjawab ok=false (waktu habis / sudah dikumpulkan).
 * - Error jaringan atau sesi diabaikan; dicoba lagi pada putaran berikutnya.
 * Setelah submit berhasil, set `enabled` ke false.
 */
export function useDraftAutosave(
  assignmentId: string,
  getAnswers: () => AnswerInput[],
  { enabled = true, intervalMs = 25_000 } = {},
) {
  const getRef = useRef(getAnswers);
  getRef.current = getAnswers;

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let last = "";

    const flush = async () => {
      if (stopped) return;
      const answers = getRef.current();
      const snap = JSON.stringify(answers);
      if (snap === last) return;
      try {
        const r = await api.saveDraft(assignmentId, answers);
        if (r.ok) last = snap;
        else stopped = true;
      } catch {
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
}
