import { ConvexError } from "convex/values";

/** Pesan di ConvexError sampai ke klien; error biasa disembunyikan Convex di production. */
export function fail(message: string): never {
  throw new ConvexError(message);
}
