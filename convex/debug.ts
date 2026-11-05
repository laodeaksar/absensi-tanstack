import { internalQuery } from "./_generated/server";
import { PBKDF2_ITERATIONS, pbkdf2Hex } from "./lib";

/**
 * Cek apakah runtime Convex mendukung PBKDF2 dan berapa lama satu hash:
 *   npx convex run debug:cryptoCheck
 * Hasil normal: { ok: true, ms: <puluhan-ratusan>, iterations: 100000 }
 */
export const cryptoCheck = internalQuery({
  args: {},
  handler: async () => {
    const t = Date.now();
    const h = await pbkdf2Hex("tes", "garam");
    return {
      ok: h.length === 64,
      ms: Date.now() - t,
      iterations: PBKDF2_ITERATIONS,
    };
  },
});
