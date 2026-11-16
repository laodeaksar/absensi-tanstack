import type { ReactNode } from "react";

/** Inisial nama, maks. `max` huruf: "Budi Santoso" -> "BS", "Budi" -> "BU". */
export function initialsOf(name: string, max = 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1)
    return Array.from(words[0]).slice(0, max).join("").toUpperCase();
  return words
    .slice(0, max)
    .map((w) => Array.from(w)[0])
    .join("")
    .toUpperCase();
}

/** Mobile: hanya inisial. Layar sm ke atas: nama lengkap (dan subjudul bila ada). */
export function ResponsiveName({
  name,
  subtitle,
}: Readonly<{ name: string; subtitle?: ReactNode }>) {
  return (
    <>
      <span
        role="img"
        aria-label={name}
        title={name}
        className="inline-flex size-8 items-center justify-center rounded-full bg-base-300 text-xs font-semibold sm:hidden"
      >
        {initialsOf(name)}
      </span>
      <div className="hidden min-w-32 pr-2 sm:block">
        <span className="block truncate font-medium">{name}</span>
        {subtitle ? (
          <span className="block truncate text-[11px] text-base-content/50">
            {subtitle}
          </span>
        ) : null}
      </div>
    </>
  );
}
