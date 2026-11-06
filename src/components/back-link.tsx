import type { LinkProps } from "@tanstack/react-router";

import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
type BackLinkProps<T extends LinkProps["to"]> = {
  to: T;
  params?: LinkProps["params"];
  search?: LinkProps["search"];
  label?: string;
  className?: string;
};

export function BackLink<T extends LinkProps["to"]>({
  to,
  params,
  search,
  label = "Kembali",
  className = "",
}: BackLinkProps<T>) {
  return (
    <Link
      to={to}
      params={params}
      search={search}
      className={`btn btn-ghost btn-xs mb-1 -ml-2 ${className}`}
    >
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}
