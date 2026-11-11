import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
  "bersihkan sesi dan catatan login",
  { hours: 6 },
  internal.maintenance.cleanup,
);
crons.interval(
  "lanjutkan semester otomatis",
  { hours: 1 },
  internal.settings.advanceSemester,
);
export default crons;
