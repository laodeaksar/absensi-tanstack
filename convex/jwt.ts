// Penandatangan JWT jangka pendek (RS256) untuk klien browser.
// Env Convex yang dibutuhkan: JWT_PRIVATE_KEY (PKCS8 PEM), JWT_JWKS (JWKS publik, JSON).
// CONVEX_SITE_URL disediakan otomatis oleh Convex.

export const JWT_AUDIENCE = "eduabsen";
export const JWT_KID = "eduabsen-1";
/** Umur JWT. Pendek, karena JWT dipegang browser; sesi sebenarnya tetap dicek di database. */
export const JWT_TTL_S = 10 * 60;

const enc = new TextEncoder();

const b64u = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const pemToDer = (pem: string) => {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

export async function signJwt(claims: Record<string, unknown>) {
  const pem = process.env.JWT_PRIVATE_KEY;
  const issuer = process.env.CONVEX_SITE_URL;
  if (!pem || !issuer) throw new Error("JWT_PRIVATE_KEY belum diatur.");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT", kid: JWT_KID };
  const payload = {
    iss: issuer,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + JWT_TTL_S,
    ...claims,
  };
  const data = `${b64u(enc.encode(JSON.stringify(header)))}.${b64u(
    enc.encode(JSON.stringify(payload)),
  )}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(data),
  );
  return `${data}.${b64u(sig)}`;
}
