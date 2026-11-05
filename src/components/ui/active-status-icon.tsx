import { CircleCheck, CircleOff } from "lucide-react";

import { Tip } from "./tooltip";

export function ActiveStatusIcon({ active }: { active: boolean }) {
  const label = active ? "Aktif" : "Nonaktif";
  const Icon = active ? CircleCheck : CircleOff;
  return (
    <Tip
      tip={label}
      side="right"
    >
      <span
        role="img"
        aria-label={label}
        tabIndex={0}
        className={`inline-flex ${active ? "text-success" : "text-base-content/40"}`}
      >
        <Icon className="size-5" />
      </span>
    </Tip>
  );
}
