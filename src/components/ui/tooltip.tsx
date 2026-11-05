import type { ReactNode } from "react";

const SIDE = {
  left: "tooltip-left",
  right: "tooltip-right",
  top: "tooltip-top",
  bottom: "tooltip-bottom",
} as const;

export function Tip({
  tip,
  side = "left",
  children,
}: {
  tip: string;
  side?: keyof typeof SIDE;
  children: ReactNode;
}) {
  return (
    <div
      className={`tooltip ${SIDE[side]}`}
      data-tip={tip}
    >
      {children}
    </div>
  );
}
