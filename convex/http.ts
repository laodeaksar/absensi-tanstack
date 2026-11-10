import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";

const http = httpRouter();

// Kunci publik untuk memverifikasi JWT (lihat auth.config.ts)
http.route({
  path: "/.well-known/jwks.json",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(process.env.JWT_JWKS ?? '{"keys":[]}', {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  }),
});

export default http;
