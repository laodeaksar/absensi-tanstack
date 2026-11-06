import { useEffect, useState } from "react";

/** Sisa detik sampai `until` (epoch ms); berhenti sendiri saat selesai. */
export function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Segarkan `now` dulu: nilai lama (mis. sejak halaman dibuka) membuat hitungan mundur terlalu besar sesaat
    setNow(Date.now());
    if (until <= Date.now()) return;

    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}
