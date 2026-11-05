import { CircleAlert } from "lucide-react";

export function ErrorAlert({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="alert alert-error alert-soft text-sm"
    >
      <CircleAlert className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
