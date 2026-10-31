import { createFileRoute } from "@tanstack/react-router";
import { allowRoles } from "~/lib/auth";
import { dashboardQuery } from "~/lib/queries";
import { DashboardPage } from "~/features/dashboard/DashboardPage";

export const Route = createFileRoute("/_app/dashboard")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["admin", "guru"]),
  loader: ({ context }) => context.queryClient.query(dashboardQuery),
  component: DashboardPage,
});

