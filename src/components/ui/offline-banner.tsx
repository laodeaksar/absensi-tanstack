import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Status jaringan peramban. Di server dianggap online agar hasil render awal sama. */
export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

export function OfflineBanner() {
  const online = useOnlineStatus();
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onOnline = () => {
      setRestored(true);
      timer = setTimeout(() => setRestored(false), 3000);
    };
    const onOffline = () => {
      clearTimeout(timer);
      setRestored(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!online)
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="no-print sticky top-0 z-[60] flex items-center justify-center gap-2 bg-orange-700 px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 text-center text-sm font-medium text-white"
      >
        <WifiOff className="size-4 shrink-0" />
        <span>
          Koneksi terputus. Anda sedang offline. Mohon tidak menutup halaman
          hingga jaringan kembali normal.
        </span>
      </div>
    );

  if (restored)
    return (
      <div
        role="status"
        className="no-print sticky top-0 z-[60] flex items-center justify-center gap-2 bg-success px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 text-center text-sm font-medium text-success-content"
      >
        <Wifi className="size-4 shrink-0" />
        <span>Koneksi kembali normal.</span>
      </div>
    );

  return null;
}