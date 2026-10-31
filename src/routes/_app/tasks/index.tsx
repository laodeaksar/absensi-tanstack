import { createFileRoute } from "@tanstack/react-router";
import { allowRoles } from "~/lib/auth";
import { myTasksQuery } from "~/lib/tugas-queries";
import { TasksPage } from "~/features/tasks/TasksPage";

export const Route = createFileRoute("/_app/tasks/")({
  beforeLoad: ({ context }) => allowRoles(context.me, ["siswa"]),
  loader: ({ context }) => context.queryClient.query(myTasksQuery),
  component: TasksPage,
});
