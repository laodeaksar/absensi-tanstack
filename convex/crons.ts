import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
  "bersihkan sesi dan catatan login",
  { hours: 6 },
  internal.maintenance.cleanup,
);
export default crons;
