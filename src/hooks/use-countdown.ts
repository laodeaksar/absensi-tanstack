import { useEffect, useState } from "react";

/** Sisa detik sampai `until` (epoch ms); berhenti sendiri saat selesai. */
export function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Segarkan `now` dulu: nilai lama (mis. sejak halaman dibuka) membuat hitungan mundur terlalu besar sesaat
    if (until <= Date.now()) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // segarkan lewat timer, bukan sinkron
    const id = setInterval(() => {
      tick();
      if (Date.now() >= until) clearInterval(id);
    }, 1000);

    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}
